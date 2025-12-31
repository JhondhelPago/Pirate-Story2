import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { SlotSymbol } from "./SlotSymbol";
import { gridRandomTypeReset, initGrid, forEachCell, SCATTERBONUS } from "./SlotUtility";
import { userSettings, SpinModeEnum } from "../utils/userSettings";

interface ReelColumn {
    container: Container;
    symbols: SlotSymbol[];
    position: number;
}

export class Match3Board {
    public match3: Match3;

    public rows = 0;
    public columns = 0;
    public tileSize = 0;

    public typesMap!: Record<number, string>;

    private backendReels: number[][] = [];
    private backendMultipliers: number[][] = [];
    private backendBonusPositions: {row: number, column: number}[] = [];

    // WILD OVERLAY (PERSISTENT)
    private wildGrid: number[][] = [];

    public piecesContainer: Container;
    public piecesMask: Graphics;

    private realLayer: Container;
    private wildLayer: Container;

    private realReels: ReelColumn[] = [];
    private wildReels: ReelColumn[] = [];

    private ticker?: Ticker;
    private _spinning = false;

    private readonly _defaultSpinSpeed = 0.45;
    private _spinSpeed = 0.45;

    private colActive: boolean[] = [];

    private _startSeqId = 0;
    private _startSequencePromise: Promise<void> | null = null;

    private readonly BLUR_EXTRA = 3;

    private get blurCount() {
        return this.rows + this.BLUR_EXTRA;
    }

    private blurIndexStart() {
        return 0;
    }
    private blurIndexEndExclusive() {
        return this.blurCount;
    }
    private leadIndexStart() {
        return this.blurCount;
    }

    private get tile() {
        return this.tileSize;
    }

    private getOffsets() {
        const tile = this.tileSize;
        return {
            offsetX: ((this.columns - 1) * tile) / 2,
            offsetY: ((this.rows - 1) * tile) / 2,
        };
    }

    private destroyReels(reels: ReelColumn[]) {
        for (const reel of reels) {
            for (const sym of reel.symbols) (sym as any)?.destroy?.();
            reel.container.removeChildren();
            reel.container.destroy();
        }
    }

    // same helper style as old board
    private makeDummyCell(y: number) {
        const dummy = new Container() as any;
        dummy.y = y;
        dummy.visible = false;
        return dummy;
    }

    private randomType(): number {
        const types = Object.keys(this.typesMap).map(Number);
        return types[Math.floor(Math.random() * types.length)];
    }

    private makeSlotSymbol(type: number, multiplier: number) {
        const sym = new SlotSymbol();
        sym.setup({
            name: this.typesMap[type],
            type,
            size: this.tileSize,
            multiplier,
        });
        sym.setBonusFlag(false);
        return sym;
    }

    private showBlur(sym: SlotSymbol) {
        sym.showBlurSprite();
    }

    private showSpine(sym: SlotSymbol) {
        sym.showSpine();
    }

    private sleep(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    private initialReels: number[][] = [];
    private initialMultipliers: number[][] = [];
    private isTubroSpin = true;

    // =========================================================================
    // LOOP-BY-REPLAY ANIMATION CONTROL
    // =========================================================================
    public hasIncomingSpinTrigger = false;
    private animating = false;

    private winLoopTween?: gsap.core.Tween;
    private wildLoopTween?: gsap.core.Tween;

    private readonly WIN_ANIM_MS = 900;

    private animationGate: Promise<void> | null = null;
    private resolveAnimationGate: (() => void) | null = null;

    private _spinToken = 0;

    // INTERRUPT / LANDING CONTROL
    private _spinInProgress = false;
    private _interruptRequested = false;
    private _hasBackendResult = false;

    // UX: only allow interrupt once ALL columns are in blur-spinning state
    private _allColumnsSpinning = false;
    private _interruptPending = false;

    // landing awareness
    private _landingInProgress = false;

    // if interrupt happens during landing, make landing super fast (no snapping)
    private _accelerateLandingRequested = false;

    // keep a handle so we can timeScale it when user interrupts during landing
    private _landingTween?: gsap.core.Tween | gsap.core.Timeline;

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesMask = new Graphics();

        this.piecesContainer = new Container();
        this.piecesContainer.mask = this.piecesMask;

        this.match3.addChild(this.piecesContainer);
        this.match3.addChild(this.piecesMask);

        this.realLayer = new Container();

        this.backendMultipliers = initGrid(5, 5, 0);
        this.wildGrid = initGrid(5, 5, 0);

        this.wildLayer = new Container();

        this.piecesContainer.addChild(this.realLayer);
        this.piecesContainer.addChild(this.wildLayer);

        window.addEventListener("keydown", (e) => {
            if (e.key.toLowerCase() === "i") {
                this.interruptSpin();
            }
        });
    }

    // needed by Match3Process
    public getBackendReels() {
        return this.backendReels;
    }
    public getBackendMultipliers() {
        return this.backendMultipliers;
    }

    public getWildReels() {
        return this.wildGrid;
    }

    public setBonusPositions(positions: {row: number, column: number}[]) {
        this.backendBonusPositions = positions;
    }

    public getBonusPositions() {
        return this.backendBonusPositions;
    }

    private cancelStartSequence() {
        this._startSeqId++;
        this._startSequencePromise = null;
    }

    private stopAndDestroyTicker() {
        this._spinning = false;
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }
    }

    private prepareSpinTransitionNoClear() {
        this.killLoops();
        this.cancelStartSequence();
        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        gsap.killTweensOf(this.realLayer);
        for (const r of this.realReels) gsap.killTweensOf(r.container);

        this._spinning = false;
    }

    // Mask
    private refreshMask() {
        const w = this.columns * this.tileSize;
        const h = this.rows * this.tileSize;
        const offsetX = w / 2;
        const offsetY = h / 2;

        this.piecesMask.clear();
        this.piecesMask.beginFill(0xffffff, 1);
        this.piecesMask.drawRect(-offsetX, -offsetY, w, h);
        this.piecesMask.endFill();
    }

    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        this.backendMultipliers = initGrid(this.rows, this.columns, 0);

        const blocks = slotGetBlocks();
        this.typesMap = {};
        for (const b of blocks) this.typesMap[b.type] = b.symbol;

        if (this.initialReels.length === 0) {
            const types = Object.keys(this.typesMap).map(Number);
            this.initialReels = initGrid(this.rows, this.columns, 0);
            this.initialMultipliers = initGrid(this.rows, this.columns, 0);

            forEachCell(this.rows, this.columns, (r, c) => {
                this.initialReels[r][c] =
                    types[Math.floor(Math.random() * types.length)];
                this.initialMultipliers[r][c] = 0;
            });
        }

        if (this.wildGrid.length === 0) {
            this.wildGrid = initGrid(this.rows, this.columns, 0);
        }

        this.refreshMask();
        this.buildIdleGridFromInitial();

        this.rebuildWildLayerStructure();
        this.applyWildGridToWildLayer();
        this.ensureWildLayerOnTop();

        this.wildLayer.visible = true;
    }

    public setInitialReels(reels: number[][], multipliers: number[][]) {
        this.initialReels = reels;
        this.initialMultipliers = multipliers;
    }

    public setWildReels(wild: number[][]) {
        this.wildGrid = wild ?? [];
        if (this.rows > 0 && this.columns > 0) {
            this.rebuildWildLayerStructureIfNeeded();
            this.applyWildGridToWildLayer();
            this.ensureWildLayerOnTop();
        }
    }

    private buildIdleGridFromInitial() {
        const { offsetX, offsetY } = this.getOffsets();

        this.realLayer.removeChildren();
        this.destroyReels(this.realReels);
        this.realReels = [];

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            for (let r = 0; r < this.rows; r++) {
                const type = this.initialReels[r][c];
                const mult = this.initialPieceMutliplier(type);

                const sym = this.makeSlotSymbol(type, mult);
                sym.setBonusFlag(false); // ✅ reset bonus flag on build

                sym.y = r * this.tile;
                this.showSpine(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }


    private getDisplayedRealSymbol(row: number, column: number): SlotSymbol | null {
        const reel = this.realReels[column];
        if (!reel) return null;

        if (reel.symbols.length === this.rows) {
            const s = reel.symbols[row];
            return s instanceof SlotSymbol ? s : null;
        }

        const idx = this.leadIndexStart() + row;
        const s = reel.symbols[idx];
        return s instanceof SlotSymbol ? s : null;
    }

    // fetch the currently displayed wild symbol (if any) at row/col
    private getDisplayedWildSymbol(row: number, column: number): SlotSymbol | null {
        const reel = this.wildReels[column] as any;
        if (!reel) return null;

        const cell = reel.symbols?.[row];
        if (!(cell instanceof SlotSymbol)) return null;

        if (!cell.visible) return null;
        const type = (cell as any).type ?? 0;
        if (type === 0) return null;

        return cell;
    }

    private getCurrentGridSnapshot(): { types: number[][]; mults: number[][] } {
        const types = initGrid(this.rows, this.columns, 0);
        const mults = initGrid(this.rows, this.columns, 0);

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {
                const cell = this.getDisplayedRealSymbol(r, c);
                if (cell) {
                    types[r][c] = (cell as any).type ?? this.initialReels?.[r]?.[c] ?? this.randomType();
                    mults[r][c] = (cell as any).multiplier ?? 0;
                } else {
                    types[r][c] = this.initialReels?.[r]?.[c] ?? this.randomType();
                    mults[r][c] = 0;
                }
            }
        }

        return { types, mults };
    }

    private hasSpinStripBuilt(): boolean {
        const r0 = this.realReels[0];
        if (!r0) return false;
        return r0.symbols.length >= this.blurCount + this.rows;
    }

    private buildSpinStripIntoCurrentLayer(leadTypes: number[][], leadMults: number[][]) {
    if (this.hasSpinStripBuilt()) return;

    const yTop = -(this.rows + this.BLUR_EXTRA) * this.tile;

    for (let c = 0; c < this.columns; c++) {
        const reel = this.realReels[c];
        const col = reel?.container;
        if (!reel || !col) continue;

        if (reel.symbols.length !== this.rows) continue;

        // ✅ FLICK FIX:
        // Do NOT call setup/showSpine on the visible 5x5 here.
        // Rebuilding the strip should only add blur symbols above.
        // (The visible grid is already correct; touching it can cause 1-frame pop.)

        const blurSyms: SlotSymbol[] = [];
        for (let j = 0; j < this.blurCount; j++) {
            const type = this.randomType();
            const sym = this.makeSlotSymbol(type, 0);
            sym.y = yTop + j * this.tile;
            this.showBlur(sym);
            blurSyms.push(sym);
        }

        for (const b of blurSyms) col.addChildAt(b, 0);

        reel.symbols = [...blurSyms, ...reel.symbols];
        reel.position = 0;
    }

    for (let c = 0; c < this.columns; c++) {
        this.setBlurVisibleForColumn(c, true);
    }
}


    private setBlurVisibleForColumn(column: number, visible: boolean) {
        const reel = this.realReels[column];
        if (!reel) return;

        if (reel.symbols.length < this.blurIndexEndExclusive()) return;

        for (let j = 0; j < this.blurCount; j++) {
            const sym = reel.symbols[this.blurIndexStart() + j];
            if (!sym) continue;
            sym.visible = visible;
        }
    }

    private updateSpin(delta: number) {
        if (!this._spinning) return;

        const yTop = -(this.rows + this.BLUR_EXTRA) * this.tile;
        const visibleBand = this.blurCount;

        for (let c = 0; c < this.realReels.length; c++) {
            if (!this.colActive[c]) continue;

            const reel = this.realReels[c];
            if (!reel || !reel.container) continue;

            if (reel.symbols.length < this.blurIndexEndExclusive()) continue;

            reel.position += this._spinSpeed * delta;

            for (let j = 0; j < this.blurCount; j++) {
                const sym = reel.symbols[this.blurIndexStart() + j];
                if (!sym) continue;

                let idx = (reel.position + j) % visibleBand;
                if (idx < 0) idx += visibleBand;

                sym.y = yTop + idx * this.tile;

                if (idx < 0.15) {
                    const nextType = this.randomType();
                    sym.setup({
                        name: this.typesMap[nextType],
                        type: nextType,
                        size: this.tileSize,
                        multiplier: 0,
                    });
                    this.showBlur(sym);
                }
            }
        }
    }

    private startSpinLoop() {
        this._spinning = true;
    }
    private stopSpinLoop() {
        this._spinning = false;
    }

    private startTickerIfNeeded() {
        if (this.ticker) return;

        this.ticker = new Ticker();
        this.ticker.add((arg: any) => {
            const delta = typeof arg === "number" ? arg : (arg?.deltaTime ?? arg?.deltaMS ?? 1);
            this.updateSpin(delta);
        });
        this.ticker.start();
    }

    /**
     * NORMAL start: wave + lift + stagger (unchanged)
     */
    private async startSpinSeamlessSequential(): Promise<void> {
        const seq = ++this._startSeqId;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;

        this.colActive = new Array(this.columns).fill(false);
        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yLead;
        }

        const WAVE_STAGGER = 0.06;
        const LIFT_PX = 25;
        const LIFT_DUR = 0.15;
        const DROP_DUR = 0.2;

        for (let c = 0; c < this.columns; c++) {
            gsap.delayedCall(c * WAVE_STAGGER, () => {
                if (seq !== this._startSeqId) return;
                this.colActive[c] = true;
            });
        }

        const cols = this.realReels.map((r) => r.container).filter(Boolean);

        const tl = gsap.timeline();

        // ✅ Flick fix: rebuild strip DURING the lift (so user won't notice)
        tl.call(() => {
            if (seq !== this._startSeqId) return;
            if (!this.hasSpinStripBuilt()) {
                const snap = this.getCurrentGridSnapshot();
                this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
            }
        }, [], 0.01);

        tl.to(cols, {
            y: yLead - LIFT_PX,
            duration: LIFT_DUR,
            ease: "power1.out",
            stagger: WAVE_STAGGER,
        });
        tl.to(
            cols,
            {
                y: yBlur,
                duration: DROP_DUR,
                ease: "none",
                stagger: WAVE_STAGGER,
            },
            ">-0.02"
        );

        await tl.then();
        if (seq !== this._startSeqId) return;

        for (let c = 0; c < this.columns; c++) this.colActive[c] = true;

        // ✅ Flick fix: strip is already built during lift, so don't rebuild here.

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yBlur;
            this.setBlurVisibleForColumn(c, true);
        }

        this._allColumnsSpinning = true;

        if (this._interruptPending && this._hasBackendResult) {
            this._interruptPending = false;
            this._spinSpeed = Math.max(this._spinSpeed, 1.8);
        }
    }

    /**
     * QUICK start: NO lift, NO stagger. All columns animate at the same time.
     * (This is what you requested.)
     */
    private async startSpinSeamlessQuickAllAtOnce(): Promise<void> {
        const seq = ++this._startSeqId;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;

        // make blur spin active immediately for all columns
        this.colActive = new Array(this.columns).fill(true);

        // reset all columns to lead position
        const cols = this.realReels.map((r) => r.container).filter(Boolean) as Container[];
        for (const col of cols) {
            gsap.killTweensOf(col);
            col.y = yLead;
        }

        // drop all at once (no lift)
        const DROP_DUR = 0.22; // tweakable: "slower turbo-ish" but still quick
        const t = gsap.to(cols, { y: yBlur, duration: DROP_DUR, ease: "none" });

        // ✅ Flick fix: rebuild strip DURING the drop (so user won't notice)
        gsap.delayedCall(0.01, () => {
            if (seq !== this._startSeqId) return;
            if (!this.hasSpinStripBuilt()) {
                const snap = this.getCurrentGridSnapshot();
                this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
            }
        });

        await t.then();
        if (seq !== this._startSeqId) return;

        // ✅ Flick fix: strip is already built during drop, so don't rebuild here.

        // lock everyone to blur-view
        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yBlur;
            this.setBlurVisibleForColumn(c, true);
            this.colActive[c] = true;
        }

        this._allColumnsSpinning = true;

        // if user already requested interrupt and backend is ready, speed up immediately
        if (this._interruptPending && this._hasBackendResult) {
            this._interruptPending = false;
            this._spinSpeed = Math.max(this._spinSpeed, 1.8);
        }
    }

    private forceAllColumnsToBlurViewAndActive() {
        this.cancelStartSequence();

        const { offsetY } = this.getOffsets();
        const yBlur = -offsetY + this.rows * this.tile;

        for (let c = 0; c < this.columns; c++) {
            this.colActive[c] = true;
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yBlur;
            this.setBlurVisibleForColumn(c, true);
        }

        this._allColumnsSpinning = true;
    }

    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        this.backendReels = reels;
        this.backendMultipliers = multipliers;
        this._hasBackendResult = Array.isArray(reels) && reels.length > 0;

        if (this._spinInProgress && this._interruptRequested && this._allColumnsSpinning) {
            this._spinSpeed = Math.max(this._spinSpeed, 1.8);
        }
    }

    private async waitForBackendReady(): Promise<void> {
        while (!this._hasBackendResult) await this.sleep(16);
    }

    // =========================================================================
    // SPIN
    // =========================================================================
    public async startSpin(): Promise<void> {
        if (this._spinInProgress) return;

        // ✅ bump token so any existing replay loops instantly stop
        this._spinToken++;

        // keep your flag too (but token is the real stop condition)
        this.hasIncomingSpinTrigger = true;

        this._spinInProgress = true;
        this._interruptRequested = false;
        this._interruptPending = false;
        this._hasBackendResult = false;

        this._allColumnsSpinning = false;
        this._landingInProgress = false;
        this._accelerateLandingRequested = false;
        this._landingTween = undefined;

        this._spinSpeed = this._defaultSpinSpeed;

        this.prepareSpinTransitionNoClear();
        this.resetWildSymbolsToIdle();

        const snap = this.getCurrentGridSnapshot();

        this.stopAndDestroyTicker();
        this.startTickerIfNeeded();
        this.startSpinLoop();

        const spinMode = userSettings.getSpinMode();

        if (spinMode === SpinModeEnum.Turbo) {
            this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
            this.forceAllColumnsToBlurViewAndActive();
            this._spinSpeed = Math.max(this._spinSpeed, 1.4);

            this._interruptPending = false;
            this._interruptRequested = false;

            this.ensureWildLayerOnTop();
            return;
        }

        // ✅ QUICK: no lift + all columns same time
        if (spinMode === SpinModeEnum.Quick) {
            // ✅ Flick fix: rebuild is handled INSIDE startSpinSeamlessQuickAllAtOnce during drop
            this._startSequencePromise = this.startSpinSeamlessQuickAllAtOnce();
            this.ensureWildLayerOnTop();
            return;
        }

        // NORMAL (unchanged): wave + lift + stagger
        // ✅ Flick fix: rebuild is handled INSIDE startSpinSeamlessSequential during lift
        this._startSequencePromise = this.startSpinSeamlessSequential();
        this.ensureWildLayerOnTop();
    }

    public interruptSpin(): void {
        if (!this._spinInProgress) return;

        const spinMode = userSettings.getSpinMode();
        if (spinMode === SpinModeEnum.Turbo) return;

        this._interruptRequested = true;

        if (!this._hasBackendResult) {
            this._interruptPending = true;
            return;
        }

        if (this._landingInProgress) {
            this._accelerateLandingRequested = true;
            try {
                (this._landingTween as any)?.timeScale?.(30);
            } catch {}
            return;
        }

        if (!this._allColumnsSpinning) {
            this._interruptPending = true;
            return;
        }

        this._spinSpeed = Math.max(this._spinSpeed, 1.8);
    }

    // =========================================================================
    // LANDING CORE
    // =========================================================================
    private applyBackendToLeadColumn(column: number) {
        const reel = this.realReels[column];
        if (!reel) return;

        if (reel.symbols.length < this.leadIndexStart() + this.rows) return;

        for (let r = 0; r < this.rows; r++) {
            const idx = this.leadIndexStart() + r;
            const sym = reel.symbols[idx];
            if (!sym) continue;

            const type = this.backendReels[r][column];
            const mult = this.backendMultipliers[r][column];

            sym.setup({
                name: this.typesMap[type],
                type,
                size: this.tileSize,
                multiplier: mult,
            });

            sym.setBonusFlag(false); // ✅ reset bonus flag whenever we rebuild lead

            this.showSpine(sym);
            sym.y = r * this.tile;
        }
    }


    private compactToFinalStaticGridInPlace() {
        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

            if (reel.symbols.length === this.rows) {
                col.y = yLead;
                for (let r = 0; r < this.rows; r++) {
                    const sym = reel.symbols[r];
                    if (!sym) continue;
                    sym.y = r * this.tile;
                    if (sym.parent !== col) col.addChild(sym);
                    this.showSpine(sym);
                }
                this.setBlurVisibleForColumn(c, false);
                this.colActive[c] = false;
                reel.position = 0;
                continue;
            }

            const leadStart = this.leadIndexStart();
            const lead = reel.symbols.slice(leadStart, leadStart + this.rows);

            const blur = reel.symbols.slice(0, leadStart);
            for (const b of blur) {
                if (!b) continue;
                if (b.parent === col) col.removeChild(b);
                try {
                    b.destroy();
                } catch {}
            }

            col.y = yLead;

            for (let r = 0; r < lead.length; r++) {
                const sym = lead[r];
                if (!sym) continue;
                sym.y = r * this.tile;
                if (sym.parent !== col) col.addChild(sym);
                this.showSpine(sym);
            }

            reel.symbols = lead;
            reel.position = 0;

            this.setBlurVisibleForColumn(c, false);
            this.colActive[c] = false;
        }
    }

    private async landColumnsSequential(): Promise<void> {
        const BOUNCE_PX = 15;
        const BOUNCE_DOWN_DUR = 0.06;
        const BOUNCE_UP_DUR = 0.08;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;
        const yFromTop = yLead - this.rows * this.tile;

        const SLIDE_DUR = this._accelerateLandingRequested ? 0.06 : 0.3;
        const BETWEEN = this._accelerateLandingRequested ? 0 : 0.06;

        const dropLayer = new Container();
        this.realLayer.addChild(dropLayer);
        this.realLayer.setChildIndex(dropLayer, this.realLayer.children.length - 1);

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container as any;
            if (!col || col?.destroyed) continue;

            gsap.killTweensOf(col);
            col.y = yBlur;

            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

            const localSlide = this._accelerateLandingRequested ? 0.05 : SLIDE_DUR;

            this.colActive[c] = true;
            col.y = yBlur;

            this.applyBackendToLeadColumn(c);

            const dropCol = new Container();
            dropCol.x = col.x;
            dropCol.y = yFromTop;
            dropLayer.addChild(dropCol);

            const leadSyms: SlotSymbol[] = [];
            for (let r = 0; r < this.rows; r++) {
                const idx = this.leadIndexStart() + r;
                const sym = reel.symbols[idx];
                if (!sym) continue;

                if (sym.parent === col) col.removeChild(sym);
                sym.y = r * this.tile;
                dropCol.addChild(sym);
                leadSyms.push(sym);
            }

            await new Promise<void>((resolve) => {
                const t = gsap.to(dropCol, { y: yLead, duration: localSlide, ease: "none" });
                this._landingTween = t;
                if (this._accelerateLandingRequested) t.timeScale(30);
                t.eventCallback("onComplete", () => resolve());
            });

            if (!col || col?.destroyed) {
                dropCol.removeChildren();
                dropCol.destroy();
                continue;
            }

            col.y = yLead;

            for (let r = 0; r < leadSyms.length; r++) {
                const sym = leadSyms[r];
                sym.y = r * this.tile;
                col.addChild(sym);
            }

            this.colActive[c] = false;
            this.setBlurVisibleForColumn(c, false);

            dropCol.removeChildren();
            dropCol.destroy();

            if (!this._accelerateLandingRequested) {
                await new Promise<void>((resolve) => {
                    if (!col || col?.destroyed) {
                        resolve();
                        return;
                    }

                    const tl = gsap.timeline({
                        onComplete: () => {
                            if (col && !col?.destroyed) col.y = yLead;
                            resolve();
                        },
                    });

                    tl.to(col, { y: yLead + BOUNCE_PX, duration: BOUNCE_DOWN_DUR, ease: "power1.out" }).to(col, {
                        y: yLead,
                        duration: BOUNCE_UP_DUR,
                        ease: "power1.in",
                    });

                    this._landingTween = tl;
                });
            }

            if (c < this.columns - 1 && BETWEEN > 0) {
                await new Promise<void>((resolve) => gsap.delayedCall(BETWEEN, () => resolve()));
            }
        }

        dropLayer.removeChildren();
        dropLayer.destroy();

        this._landingTween = undefined;
        this._accelerateLandingRequested = false;
    }

    private async landColumnsAllAtOnce(opts?: {
        slideDur?: number;
        bouncePx?: number;
        bounceDownDur?: number;
        bounceUpDur?: number;
    }): Promise<void> {
        const baseSlide = opts?.slideDur ?? 0.26;

        const SLIDE_DUR = this._accelerateLandingRequested ? Math.min(0.08, baseSlide) : baseSlide;

        const BOUNCE_PX = this._accelerateLandingRequested ? 0 : opts?.bouncePx ?? 12;
        const BOUNCE_DOWN_DUR = this._accelerateLandingRequested ? 0 : opts?.bounceDownDur ?? 0.06;
        const BOUNCE_UP_DUR = this._accelerateLandingRequested ? 0 : opts?.bounceUpDur ?? 0.08;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;
        const yFromTop = yLead - this.rows * this.tile;

        const dropLayer = new Container();
        this.realLayer.addChild(dropLayer);
        this.realLayer.setChildIndex(dropLayer, this.realLayer.children.length - 1);

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container as any;
            if (!col || col?.destroyed) continue;

            gsap.killTweensOf(col);
            col.y = yBlur;

            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        const dropCols: Container[] = [];
        const leadSymsByCol: SlotSymbol[][] = [];

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

            this.applyBackendToLeadColumn(c);

            const dropCol = new Container();
            dropCol.x = col.x;
            dropCol.y = yFromTop;
            dropLayer.addChild(dropCol);

            const leadSyms: SlotSymbol[] = [];
            for (let r = 0; r < this.rows; r++) {
                const idx = this.leadIndexStart() + r;
                const sym = reel.symbols[idx];
                if (!sym) continue;

                if (sym.parent === col) col.removeChild(sym);
                sym.y = r * this.tile;
                dropCol.addChild(sym);
                leadSyms.push(sym);
            }

            dropCols.push(dropCol);
            leadSymsByCol[c] = leadSyms;
        }

        await new Promise<void>((resolve) => {
            const t = gsap.to(dropCols, { y: yLead, duration: SLIDE_DUR, ease: "none" });
            this._landingTween = t;
            if (this._accelerateLandingRequested) t.timeScale(30);
            t.eventCallback("onComplete", () => resolve());
        });

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

            col.y = yLead;

            const leadSyms = leadSymsByCol[c] ?? [];
            for (let r = 0; r < leadSyms.length; r++) {
                const sym = leadSyms[r];
                sym.y = r * this.tile;
                col.addChild(sym);
            }

            this.colActive[c] = false;
            this.setBlurVisibleForColumn(c, false);
        }

        for (const dc of dropCols) {
            dc.removeChildren();
            dc.destroy();
        }
        dropLayer.removeChildren();
        dropLayer.destroy();

        this._landingTween = undefined;

        if (BOUNCE_PX > 0 && (BOUNCE_DOWN_DUR > 0 || BOUNCE_UP_DUR > 0)) {
            const cols = this.realReels.map((r) => r.container).filter(Boolean) as any[];

            await new Promise<void>((resolve) => {
                const tl = gsap.timeline({
                    onComplete: () => {
                        for (const c of cols) {
                            if (c && !c?.destroyed) c.y = yLead;
                        }
                        resolve();
                    },
                });

                tl.to(cols, { y: yLead + BOUNCE_PX, duration: BOUNCE_DOWN_DUR, ease: "power1.out" }).to(cols, {
                    y: yLead,
                    duration: BOUNCE_UP_DUR,
                    ease: "power1.in",
                });

                this._landingTween = tl;
                if (this._accelerateLandingRequested) tl.timeScale(30);
            });
        }

        this._accelerateLandingRequested = false;
    }

    // =========================================================================
    // FINISH WRAPPER (Match3Process expects this!)
    // =========================================================================
    public async finishSpin(): Promise<void> {
        if (this._startSequencePromise) {
            await this._startSequencePromise;
        }

        await this.waitForBackendReady();

        const spinMode = userSettings.getSpinMode();

        if (spinMode === SpinModeEnum.Normal) {
            await this.finishSpinNormal();
        } else if (spinMode === SpinModeEnum.Quick) {
            await this.finishSpinQuick();
        } else if (spinMode === SpinModeEnum.Turbo) {
            await this.finishSpinTurbo();
        } else {
            await this.finishSpinQuick();
        }

        this._spinSpeed = this._defaultSpinSpeed;
        this._spinInProgress = false;
        this._interruptRequested = false;
        this._interruptPending = false;
        this._landingInProgress = false;
        this._accelerateLandingRequested = false;
        this._landingTween = undefined;
    }

    public async finishSpinNormal(): Promise<void> {
        if (this._interruptRequested && this._hasBackendResult) {
            this._accelerateLandingRequested = true;
        }

        this._landingInProgress = true;
        try {
            await this.landColumnsSequential();
        } finally {
            this._landingInProgress = false;
        }

        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        this.compactToFinalStaticGridInPlace();
        this.ensureWildLayerOnTop();

        // update wild visuals before animating (so priority check sees real wild symbols)
        this.setWildReels(this.match3.process.getWildReels());

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinsWithWildPriority(wins, this.getBonusPositions());
        
    }

    public async finishSpinQuick(): Promise<void> {
        if (this._interruptRequested && this._hasBackendResult) {
            this._accelerateLandingRequested = true;
        }

        this._landingInProgress = true;
        try {
            await this.landColumnsAllAtOnce({
                slideDur: 0.26,
                bouncePx: 12,
                bounceDownDur: 0.06,
                bounceUpDur: 0.08,
            });
        } finally {
            this._landingInProgress = false;
        }

        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        this.compactToFinalStaticGridInPlace();
        this.ensureWildLayerOnTop();

        // update wild visuals before animating (so priority check sees real wild symbols)
        this.setWildReels(this.match3.process.getWildReels());

        const wins = this.match3.process.getWinningPositions() ?? [];
        
        // add the position argument of the bonusPositions
        this.animateWinsWithWildPriority(wins);
    }

    public async finishSpinTurbo(): Promise<void> {
        this._interruptRequested = false;
        this._accelerateLandingRequested = false;

        this._landingInProgress = true;
        try {
            await this.landColumnsAllAtOnce({
                slideDur: 0.10,
                bouncePx: 0,
                bounceDownDur: 0,
                bounceUpDur: 0,
            });
        } finally {
            this._landingInProgress = false;
        }

        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        this.compactToFinalStaticGridInPlace();
        this.ensureWildLayerOnTop();

        // update wild visuals before animating (so priority check sees real wild symbols)
        this.setWildReels(this.match3.process.getWildReels());

        const wins = this.match3.process.getWinningPositions() ?? [];
        // add the position argument of the bonusPositions
        this.animateWinsWithWildPriority(wins);
    }

    // =========================================================================
    // LOOP-BY-REPLAY HELPERS (infinite until next spin trigger)
    // =========================================================================
    private openAnimationGate() {
        if (this.animationGate) return;
        this.animationGate = new Promise<void>((resolve) => {
            this.resolveAnimationGate = resolve;
        });
        this.animating = true;
    }

    private closeAnimationGate() {
        this.animating = false;
        const r = this.resolveAnimationGate;
        this.resolveAnimationGate = null;
        this.animationGate = null;
        if (r) r();
    }

    private killLoops() {
        this.winLoopTween?.kill();
        this.wildLoopTween?.kill();
        this.winLoopTween = undefined;
        this.wildLoopTween = undefined;
    }

    private forceReplaySymbolOnce(sym: SlotSymbol) {
        try {
            sym.resetToSetupPose?.();
        } catch {}

        try {
            const spine: any = (sym as any).spine ?? (sym as any)._spine ?? (sym as any).skeletonAnimation;
            spine?.state?.clearTracks?.();
        } catch {}

        sym.animatePlay(false);
    }

    // ✅ FIXED: infinite loop until next spin (token changes)
    private startReplayLoop(getSymbols: () => SlotSymbol[], which: "win" | "wild") {
        if (which === "win") this.winLoopTween?.kill();
        else this.wildLoopTween?.kill();

        this.openAnimationGate();

        // ✅ capture token at the time we start looping
        const token = this._spinToken;

        // ✅ IMPORTANT: clear the old flag so it doesn't auto-stop the loop
        this.hasIncomingSpinTrigger = false;

        const tick = () => {
            // ✅ stop ONLY if a new spin started
            if (token !== this._spinToken) {
                this.closeAnimationGate();
                return;
            }

            const symbols = getSymbols();

            if (!symbols.length) {
                // no symbols to animate -> stop
                this.closeAnimationGate();
                return;
            }

            for (const s of symbols) {
                if (!s || !s.visible) continue;
                if ((s as any).type === 0) continue;

                this.forceReplaySymbolOnce(s);
            }

            const t = gsap.delayedCall(this.WIN_ANIM_MS / 1000, () => {
                tick();
            });

            if (which === "win") this.winLoopTween = t;
            else this.wildLoopTween = t;
        };

        tick();
    }

    public animateWinningSymbols(wins: { row: number; column: number }[]) {
        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];
            for (const { row, column } of wins) {
                const symbol = this.getDisplayedRealSymbol(row, column);
                if (symbol) list.push(symbol);
            }
            return list;
        }, "win");
    }

    public animateWinsWithWildPriority(
        wins: { row: number; column: number }[],
        bonusPositions?: { row: number; column: number }[]
    ) {
        const rows = this.rows > 0 ? this.rows : 5;
        const cols = this.columns > 0 ? this.columns : 5;

        const uniq: { row: number; column: number }[] = [];
        const seen = new Set<string>();

        const push = (p: { row: number; column: number } | null | undefined) => {
            if (!p) return;
            const row = Math.max(0, Math.min(rows - 1, p.row));
            const column = Math.max(0, Math.min(cols - 1, p.column));
            const k = `${row}:${column}`;
            if (seen.has(k)) return;
            seen.add(k);
            uniq.push({ row, column });
        };

        // always include wins
        for (const p of wins ?? []) push(p);

        // ✅ only include bonusPositions if currently using FreeSpinProcess with ,isIntialFreeSpin == true, and none free spin feature
        const isFreeSpin = this.match3?.process === this.match3?.freeSpinProcess;
        const isInitialSpin = isFreeSpin ? this.match3?.freeSpinProcess.getIsInitialFreeSpin() : false;

        if (!isFreeSpin || (isFreeSpin && isInitialSpin)) {
            if (Array.isArray(bonusPositions) && bonusPositions.length >= 2) {
                for (const p of bonusPositions) push(p);
            }
        } 
        
        else { // free spin feature bonus reels aas symbol badge
            if (Array.isArray(bonusPositions)) {
                for (const { row, column } of bonusPositions) {
                    const r = Math.max(0, Math.min(rows - 1, row));
                    const c = Math.max(0, Math.min(cols - 1, column));

                    // priority: wild layer first
                    const wild = this.getDisplayedWildSymbol(r, c);
                    if (wild) {
                        wild.setBonusFlag(true);
                    }

                    const sym = this.getDisplayedRealSymbol(r, c);
                    if (sym && sym.type !== SCATTERBONUS) {
                        sym.setBonusFlag(true);
                    }
                }
                // set to emtpy after using the position to the UI
                this.backendBonusPositions = [];
            }
        }

        if (!uniq.length) {
            this.killLoops();
            return;
        }

        const wildPositions: { row: number; column: number }[] = [];
        const realPositions: { row: number; column: number }[] = [];

        for (const { row, column } of uniq) {
            const wild = this.getDisplayedWildSymbol(row, column);
            if (wild) wildPositions.push({ row, column });
            else realPositions.push({ row, column });
        }

        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];
            for (const { row, column } of wildPositions) {
                const s = this.getDisplayedWildSymbol(row, column);
                if (s) list.push(s);
            }
            return list;
        }, "wild");

        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];
            for (const { row, column } of realPositions) {
                const s = this.getDisplayedRealSymbol(row, column);
                if (s) list.push(s);
            }
            return list;
        }, "win");
    }


    public initialPieceMutliplier(symbolType: number) {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier = multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];
        return [11, 12].includes(symbolType) ? randomMultiplier : 0;
    }

    public getTurboSpin() {
        return this.isTubroSpin;
    }

    private ensureWildLayerOnTop() {
        if (!this.wildLayer.parent) this.piecesContainer.addChild(this.wildLayer);
        this.piecesContainer.setChildIndex(this.wildLayer, this.piecesContainer.children.length - 1);
    }

    private rebuildWildLayerStructureIfNeeded() {
        if (this.wildReels.length !== this.columns) return this.rebuildWildLayerStructure();

        for (let c = 0; c < this.columns; c++) {
            const reel = this.wildReels[c];
            if (!reel || reel.symbols.length !== this.rows) return this.rebuildWildLayerStructure();
        }
    }

    private rebuildWildLayerStructure() {
        this.destroyReels(this.wildReels);
        this.wildReels = [];
        this.wildLayer.removeChildren();

        const { offsetX, offsetY } = this.getOffsets();

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            this.wildLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            for (let r = 0; r < this.rows; r++) {
                const dummy = this.makeDummyCell(r * this.tile);
                col.addChild(dummy);
                reel.symbols.push(dummy as any);
            }

            this.wildReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    private applyWildGridToWildLayer() {
        if (!this.wildReels.length) return;

        const tile = this.tileSize;

        forEachCell(this.rows, this.columns, (r, c) => {
            const reel = this.wildReels[c];
            if (!reel) return;

            const current: any = reel.symbols[r];
            const type = this.wildGrid?.[r]?.[c] ?? 0;
            const mult = this.backendMultipliers?.[r]?.[c] ?? 0;

            const removeCurrent = () => {
                if (current?.parent === reel.container) {
                    reel.container.removeChild(current);
                }
            };

            if (type === 0 || !this.typesMap[type]) {
                if (current instanceof SlotSymbol) current.destroy();
                removeCurrent();

                const dummy = this.makeDummyCell(r * tile);
                reel.container.addChildAt(dummy, r);
                reel.symbols[r] = dummy as any;
                return;
            }

            if (!(current instanceof SlotSymbol)) {
                removeCurrent();

                const sym = this.makeSlotSymbol(type, mult);
                sym.setBonusFlag(false); // ✅ reset bonus flag on create
                sym.y = r * tile;

                this.showSpine(sym);

                reel.container.addChildAt(sym, r);
                reel.symbols[r] = sym as any;
                return;
            }

            const existing = current as SlotSymbol;

            if ((existing as any).type !== type) {
                existing.destroy();
                removeCurrent();

                const sym = this.makeSlotSymbol(type, mult);
                sym.setBonusFlag(false); // ✅ reset bonus flag on create
                sym.y = r * tile;

                this.showSpine(sym);

                reel.container.addChildAt(sym, r);
                reel.symbols[r] = sym as any;
                return;
            }

            existing.setBonusFlag(false); // ✅ reset bonus flag on reuse
            existing.visible = true;
            existing.y = r * tile;
            this.showSpine(existing);
        });

        this.ensureWildLayerOnTop();
    }


    private resetWildSymbolsToIdle() {
        for (let c = 0; c < this.wildReels.length; c++) {
            const reel = this.wildReels[c] as any;
            if (!reel) continue;

            for (let r = 0; r < reel.symbols.length; r++) {
                const cell = reel.symbols[r];
                if (!(cell instanceof SlotSymbol)) continue;

                cell.resetToSetupPose();
                gsap.killTweensOf(cell);
                gsap.killTweensOf(cell.scale);
                cell.scale.set(1);
            }
        }
    }

    public clearWildLayerAndMultipliers() {
        const rows = this.rows > 0 ? this.rows : 5;
        const cols = this.columns > 0 ? this.columns : 5;

        this.backendMultipliers = initGrid(rows, cols, 0);
        this.wildGrid = initGrid(rows, cols, 0);
        this.backendReels = gridRandomTypeReset();

        if (this.rows > 0 && this.columns > 0) {
            this.rebuildWildLayerStructureIfNeeded();
            this.applyWildGridToWildLayer();
            this.ensureWildLayerOnTop();
        }
    }

    // specific function for the end spin session of the free spin process
    public rebuildReelsAndAnimatePositions(
        reels5x5: number[][],
        bonus5x5: number[][],
        positions: { row: number; column: number }[]
    ) {
        const rows = this.rows > 0 ? this.rows : 5;
        const cols = this.columns > 0 ? this.columns : 5;

        const safeTypes = initGrid(rows, cols, 0);
        const safeMults = initGrid(rows, cols, 0);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                safeTypes[r][c] =
                    reels5x5?.[r]?.[c] ??
                    this.initialReels?.[r]?.[c] ??
                    this.randomType();

                safeMults[r][c] = bonus5x5?.[r]?.[c] ?? 0;
            }
        }

        this.prepareSpinTransitionNoClear();
        this.stopAndDestroyTicker();

        this.backendReels = safeTypes;
        this.backendMultipliers = safeMults;
        this._hasBackendResult = true;

        this.compactToFinalStaticGridInPlace();

        // ✅ rebuild REAL 5x5 and always reset bonus flags
        for (let c = 0; c < cols; c++) {
            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

            if (reel.symbols.length !== rows) {
                reel.symbols = reel.symbols.slice(0, rows);
            }

            for (let r = 0; r < rows; r++) {
                const type = safeTypes[r][c];
                const mult = safeMults[r][c] ?? 0;

                let sym = reel.symbols[r];
                if (!sym) {
                    sym = this.makeSlotSymbol(type, mult);
                    reel.symbols[r] = sym;
                    col.addChild(sym);
                }

                sym.setup({
                    name: this.typesMap[type],
                    type,
                    size: this.tileSize,
                    multiplier: mult,
                });


                this.showSpine(sym);
                sym.visible = true;
                sym.y = r * this.tile;
                if (sym.parent !== col) col.addChild(sym);
            }

            reel.position = 0;
            this.colActive[c] = false;
            this.setBlurVisibleForColumn(c, false);

            const { offsetY } = this.getOffsets();
            col.y = -offsetY;
        }

        this.ensureWildLayerOnTop();

        // ✅ rebuild WILD layer and also ensure flags are reset inside applyWildGridToWildLayer()
        if (this.rows > 0 && this.columns > 0) {
            this.rebuildWildLayerStructureIfNeeded();
            this.applyWildGridToWildLayer(); // (make sure this function resets bonus flags too)
            this.ensureWildLayerOnTop();
        }

        const cleaned: { row: number; column: number }[] = [];
        const seen = new Set<string>();
        for (const p of positions ?? []) {
            const row = Math.max(0, Math.min(rows - 1, p.row));
            const column = Math.max(0, Math.min(cols - 1, p.column));
            const k = `${row}:${column}`;
            if (seen.has(k)) continue;
            seen.add(k);
            cleaned.push({ row, column });
        }

        if (cleaned.length) {
            this.animateWinsWithWildPriority(cleaned, this.getBonusPositions());
        } else {
            this.killLoops();
        }
    }

}
