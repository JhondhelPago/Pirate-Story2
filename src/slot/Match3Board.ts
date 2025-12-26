import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { SlotSymbol } from "./SlotSymbol";
import { gridRandomTypeReset } from "./SlotUtility";
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
    private get maskH() {
        return this.rows * this.tileSize;
    }

    private initGrid(rows: number, cols: number, fill = 0) {
        return Array.from({ length: rows }, () => Array(cols).fill(fill));
    }

    private getOffsets() {
        const tile = this.tileSize;
        return {
            offsetX: ((this.columns - 1) * tile) / 2,
            offsetY: ((this.rows - 1) * tile) / 2,
        };
    }

    private forEachCell(fn: (r: number, c: number) => void) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) fn(r, c);
        }
    }

    private destroyReels(reels: ReelColumn[]) {
        for (const reel of reels) {
            for (const sym of reel.symbols) (sym as any)?.destroy?.();
            reel.container.removeChildren();
            reel.container.destroy();
        }
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

    // =========================================================================
    // INTERRUPT SPIN CONTROL
    // =========================================================================
    private _spinInProgress = false;
    private _interruptRequested = false;
    private _hasBackendResult = false;

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesMask = new Graphics();

        this.piecesContainer = new Container();
        this.piecesContainer.mask = this.piecesMask;

        this.match3.addChild(this.piecesContainer);
        this.match3.addChild(this.piecesMask);

        this.realLayer = new Container();

        this.backendMultipliers = this.initGrid(5, 5, 0);
        this.wildGrid = this.initGrid(5, 5, 0);

        this.wildLayer = new Container();

        this.piecesContainer.addChild(this.realLayer);
        this.piecesContainer.addChild(this.wildLayer);

        window.addEventListener("keydown", (e) => {
            if (e.key.toLowerCase() === "i") {
                this.match3.board.interruptSpin();
            }
        });
    }

    // ✅ needed by Match3Process
    public getBackendReels() {
        return this.backendReels;
    }
    public getBackendMultipliers() {
        return this.backendMultipliers;
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

    // =========================================================================
    // MASK
    // =========================================================================
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

    // =========================================================================
    // SETUP
    // =========================================================================
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        this.backendMultipliers = this.initGrid(this.rows, this.columns, 0);

        const blocks = slotGetBlocks();
        this.typesMap = {};
        for (const b of blocks) this.typesMap[b.type] = b.symbol;

        if (this.initialReels.length === 0) {
            const types = Object.keys(this.typesMap).map(Number);
            this.initialReels = this.initGrid(this.rows, this.columns, 0);
            this.initialMultipliers = this.initGrid(this.rows, this.columns, 0);

            this.forEachCell((r, c) => {
                this.initialReels[r][c] = types[Math.floor(Math.random() * types.length)];
                this.initialMultipliers[r][c] = 0;
            });
        }

        if (this.wildGrid.length === 0) {
            this.wildGrid = this.initGrid(this.rows, this.columns, 0);
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

    // =========================================================================
    // IDLE GRID (SPINE)
    // =========================================================================
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
                sym.y = r * this.tile;
                this.showSpine(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // ✅ Unified accessor:
    // - during spin strip => symbols include blur + lead, so use leadIndexStart()+row
    // - final static grid => symbols length === rows, so use row directly
    // =========================================================================
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

    // =========================================================================
    // CAPTURE CURRENT DISPLAYED GRID (for lead continuity)
    // =========================================================================
    private getCurrentGridSnapshot(): { types: number[][]; mults: number[][] } {
        const types = this.initGrid(this.rows, this.columns, 0);
        const mults = this.initGrid(this.rows, this.columns, 0);

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

    // =========================================================================
    // DESTROY/REBUILD
    // =========================================================================
    private destroyAllLayers() {
        this.killLoops();

        this.cancelStartSequence();
        this.stopAndDestroyTicker();

        gsap.killTweensOf(this.realLayer);
        for (const r of this.realReels) gsap.killTweensOf(r.container);

        this.realLayer.removeChildren();
        this.destroyReels(this.realReels);
        this.realReels = [];

        this.colActive = new Array(this.columns).fill(false);
        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD SPIN STRIP
    // =========================================================================
    private buildSpinStripLayer(leadTypes: number[][], leadMults: number[][]) {
        const { offsetX, offsetY } = this.getOffsets();

        this.realLayer.visible = false;

        this.realLayer.removeChildren();
        this.destroyReels(this.realReels);
        this.realReels = [];

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            const yTop = -(this.rows + this.BLUR_EXTRA) * this.tile;

            for (let j = 0; j < this.blurCount; j++) {
                const type = this.randomType();
                const sym = this.makeSlotSymbol(type, 0);
                sym.y = yTop + j * this.tile;
                this.showBlur(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            for (let r = 0; r < this.rows; r++) {
                const type = leadTypes[r][c];
                const mult = leadMults[r][c] ?? 0;

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * this.tile;
                this.showSpine(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.stopAndDestroyTicker();
        this.ticker = new Ticker();

        this.ticker.add((arg: any) => {
            const delta = typeof arg === "number" ? arg : (arg?.deltaTime ?? arg?.deltaMS ?? 1);
            this.updateSpin(delta);
        });

        this.ticker.start();
        this.ensureWildLayerOnTop();
        this.realLayer.visible = true;
    }

    private setBlurVisibleForColumn(column: number, visible: boolean) {
        const reel = this.realReels[column];
        if (!reel) return;

        for (let j = 0; j < this.blurCount; j++) {
            const sym = reel.symbols[this.blurIndexStart() + j];
            if (!sym) continue;
            sym.visible = visible;
        }
    }

    // =========================================================================
    // SPIN UPDATE
    // =========================================================================
    private updateSpin(delta: number) {
        if (!this._spinning) return;

        const yTop = -(this.rows + this.BLUR_EXTRA) * this.tile;
        const visibleBand = this.blurCount;

        for (let c = 0; c < this.realReels.length; c++) {
            if (!this.colActive[c]) continue;

            const reel = this.realReels[c];
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

    // =========================================================================
    // START SPIN: wave
    // =========================================================================
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
            this.setBlurVisibleForColumn(c, true);
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

        const cols = this.realReels.map((r) => r.container);

        const tl = gsap.timeline();
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
    }

    // =========================================================================
    // BACKEND STORE
    // =========================================================================
    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        this.backendReels = reels;
        this.backendMultipliers = multipliers;

        this._hasBackendResult = Array.isArray(reels) && reels.length > 0;

        // ⚠️ If interrupt was requested, we can land instantly BUT
        // we must wait for process to compute winningPositions first.
        if (this._spinInProgress && this._interruptRequested && this._hasBackendResult) {
            void this.finishSpinInstantFromInterruptAsync();
        }
    }

    // =========================================================================
    // SPIN
    // =========================================================================
    public async startSpin(): Promise<void> {
        if (this._spinInProgress) return;

        this._spinInProgress = true;
        this._interruptRequested = false;
        this._hasBackendResult = false;

        this._spinSpeed = this._defaultSpinSpeed;

        this.killLoops();
        this.resetWildSymbolsToIdle();

        const snap = this.getCurrentGridSnapshot();

        this.destroyAllLayers();
        this.buildSpinStripLayer(snap.types, snap.mults);

        this.startSpinLoop();

        // ✅ Turbo: remove “sequence momentum” (no wave)
        const spinMode = userSettings.getSpinMode();
        if (spinMode === SpinModeEnum.Turbo) {
            this.forceAllColumnsToBlurViewAndActive();
            this._spinSpeed = Math.max(this._spinSpeed, 1.4);
            this._startSequencePromise = null;
        } else {
            this._startSequencePromise = this.startSpinSeamlessSequential();
        }

        this.ensureWildLayerOnTop();
    }

    public interruptSpin(): void {
        if (!this._spinInProgress) return;

        this._interruptRequested = true;
        this.forceAllColumnsToBlurViewAndActive();

        if (!this._hasBackendResult) {
            this._spinSpeed = Math.max(this._spinSpeed, 1.2);
            this.startSpinLoop();
            return;
        }

        void this.finishSpinInstantFromInterruptAsync();
    }

    private async waitForWinningPositionsReady(maxMs = 500): Promise<void> {
        const t0 = performance.now();
        while (performance.now() - t0 < maxMs) {
            const wins = this.match3.process.getWinningPositions();
            if (wins && wins.length >= 0) return;
            await this.sleep(16);
        }
    }

    private async finishSpinInstantFromInterruptAsync(): Promise<void> {
        if (!this._spinInProgress) return;
        if (!this._hasBackendResult) return;

        // ✅ wait a moment for process to compute winners
        await this.waitForWinningPositionsReady(600);

        this.cancelStartSequence();
        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        for (const r of this.realReels) gsap.killTweensOf(r.container);

        this.applyBackendToFinalStaticGrid();
        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);

        this._spinSpeed = this._defaultSpinSpeed;

        this._spinInProgress = false;
        this._interruptRequested = false;
    }

    private async waitForBackendReady(): Promise<void> {
        while (!this._hasBackendResult) {
            await this.sleep(16);
        }
    }

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
    }

    // =========================================================================
    // LANDING CORE
    // =========================================================================
    private applyBackendToLeadColumn(column: number) {
        const reel = this.realReels[column];
        if (!reel) return;

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
            this.showSpine(sym);
            sym.y = r * this.tile;
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

        const SLIDE_DUR = 0.3;
        const BETWEEN = 0.06;

        const dropLayer = new Container();
        this.realLayer.addChild(dropLayer);
        this.realLayer.setChildIndex(dropLayer, this.realLayer.children.length - 1);

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yBlur;
            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container;
            if (!reel || !col) continue;

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
                const t = gsap.to(dropCol, { y: yLead, duration: SLIDE_DUR, ease: "none" });
                t.eventCallback("onComplete", () => resolve());
            });

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

            await new Promise<void>((resolve) => {
                const tl = gsap.timeline({
                    onComplete: () => {
                        col.y = yLead;
                        resolve();
                    },
                });

                tl.to(col, { y: yLead + BOUNCE_PX, duration: BOUNCE_DOWN_DUR, ease: "power1.out" }).to(col, {
                    y: yLead,
                    duration: BOUNCE_UP_DUR,
                    ease: "power1.in",
                });
            });

            if (c < this.columns - 1 && BETWEEN > 0) {
                await new Promise<void>((resolve) => gsap.delayedCall(BETWEEN, () => resolve()));
            }
        }

        dropLayer.removeChildren();
        dropLayer.destroy();
    }

    private async landColumnsAllAtOnce(opts?: {
        slideDur?: number;
        bouncePx?: number;
        bounceDownDur?: number;
        bounceUpDur?: number;
    }): Promise<void> {
        const SLIDE_DUR = opts?.slideDur ?? 0.26;

        const BOUNCE_PX = opts?.bouncePx ?? 12;
        const BOUNCE_DOWN_DUR = opts?.bounceDownDur ?? 0.06;
        const BOUNCE_UP_DUR = opts?.bounceUpDur ?? 0.08;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;
        const yFromTop = yLead - this.rows * this.tile;

        const dropLayer = new Container();
        this.realLayer.addChild(dropLayer);
        this.realLayer.setChildIndex(dropLayer, this.realLayer.children.length - 1);

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;

            gsap.killTweensOf(col);
            col.y = yBlur;

            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        const dropCols: Container[] = [];
        const leadSymsByCol: SlotSymbol[][] = [];

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container;
            if (!reel || !col) continue;

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
            t.eventCallback("onComplete", () => resolve());
        });

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel?.container;
            if (!reel || !col) continue;

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

        // ✅ Optional bounce: allow disabling (Turbo uses 0)
        if (BOUNCE_PX > 0 && (BOUNCE_DOWN_DUR > 0 || BOUNCE_UP_DUR > 0)) {
            const cols = this.realReels.map((r) => r.container);
            await new Promise<void>((resolve) => {
                const tl = gsap.timeline({
                    onComplete: () => {
                        for (const c of cols) c.y = yLead;
                        resolve();
                    },
                });

                tl.to(cols, { y: yLead + BOUNCE_PX, duration: BOUNCE_DOWN_DUR, ease: "power1.out" }).to(cols, {
                    y: yLead,
                    duration: BOUNCE_UP_DUR,
                    ease: "power1.in",
                });
            });
        }
    }

    // =========================================================================
    // FINAL APPLY (STATIC 5x5)
    // =========================================================================
    public applyBackendToFinalStaticGrid() {
        this.cancelStartSequence();
        this.stopAndDestroyTicker();

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
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * this.tile;
                this.showSpine(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // FINISH
    // =========================================================================
    public async finishSpinNormal(): Promise<void> {
        await this.landColumnsSequential();

        this.stopSpinLoop();
        this.stopAndDestroyTicker();
        this.applyBackendToFinalStaticGrid();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    public async finishSpinQuick(): Promise<void> {
        await this.landColumnsAllAtOnce({
            slideDur: 0.26,
            bouncePx: 12,
            bounceDownDur: 0.06,
            bounceUpDur: 0.08,
        });

        this.stopSpinLoop();
        this.stopAndDestroyTicker();
        this.applyBackendToFinalStaticGrid();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    public async finishSpinTurbo(): Promise<void> {
        // ✅ Turbo: faster, NO bounce, NO extra “momentum”
        await this.landColumnsAllAtOnce({
            slideDur: 0.10,
            bouncePx: 0,
            bounceDownDur: 0,
            bounceUpDur: 0,
        });

        this.stopSpinLoop();
        this.stopAndDestroyTicker();
        this.applyBackendToFinalStaticGrid();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    // =========================================================================
    // LOOP-BY-REPLAY HELPERS
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

    private startReplayLoop(getSymbols: () => SlotSymbol[], which: "win" | "wild") {
        if (which === "win") this.winLoopTween?.kill();
        else this.wildLoopTween?.kill();

        this.openAnimationGate();

        const tick = () => {
            const symbols = getSymbols();

            if (!symbols.length) {
                this.closeAnimationGate();
                return;
            }

            for (const s of symbols) {
                if (!s.visible) continue;
                if ((s as any).type === 0) continue;
                s.animatePlay(false);
            }

            const t = gsap.delayedCall(this.WIN_ANIM_MS / 1000, () => {
                if (this.hasIncomingSpinTrigger) {
                    this.hasIncomingSpinTrigger = false;
                    this.closeAnimationGate();
                    return;
                }
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

    // =========================================================================
    // MULTIPLIER HELPER
    // =========================================================================
    public initialPieceMutliplier(symbolType: number) {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier = multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];
        return [11, 12].includes(symbolType) ? randomMultiplier : 0;
    }

    public getTurboSpin() {
        return this.isTubroSpin;
    }

    // =========================================================================
    // WILD LAYER
    // =========================================================================
    private ensureWildLayerOnTop() {
        if (!this.wildLayer.parent) this.piecesContainer.addChild(this.wildLayer);
        this.piecesContainer.setChildIndex(this.wildLayer, this.piecesContainer.children.length - 1);
    }

    private rebuildWildLayerStructureIfNeeded() {
        if (this.wildReels.length !== this.columns) return this.rebuildWildLayerStructure();

        for (let c = 0; c < this.columns; c++) {
            const reel = this.wildReels[c];
            if (!reel || (reel as any).symbols.length !== this.rows) return this.rebuildWildLayerStructure();
        }
    }

    private rebuildWildLayerStructure() {
        this.destroyReels(this.wildReels as any);
        this.wildReels = [];
        this.wildLayer.removeChildren();

        const { offsetX, offsetY } = this.getOffsets();

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            this.wildLayer.addChild(col);

            const reel: any = { container: col, symbols: [], position: 0 };

            for (let r = 0; r < this.rows; r++) {
                const dummy = new Container() as any;
                dummy.y = r * this.tile;
                dummy.visible = false;
                col.addChild(dummy);
                reel.symbols.push(dummy);
            }

            this.wildReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    private applyWildGridToWildLayer() {
        if (!this.wildReels.length) return;

        const tile = this.tileSize;

        this.forEachCell((r, c) => {
            const reel: any = this.wildReels[c];
            if (!reel) return;

            const current: any = reel.symbols[r];
            const type = this.wildGrid?.[r]?.[c] ?? 0;
            const mult = this.backendMultipliers?.[r]?.[c] ?? 0;

            const removeCurrent = () => {
                if (current?.parent === reel.container) reel.container.removeChild(current);
            };

            if (type === 0 || !this.typesMap[type]) {
                if (current instanceof SlotSymbol) current.destroy();
                removeCurrent();

                const dummy = new Container() as any;
                dummy.y = r * tile;
                dummy.visible = false;

                reel.container.addChildAt(dummy, r);
                reel.symbols[r] = dummy;
                return;
            }

            if (!(current instanceof SlotSymbol)) {
                removeCurrent();

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * tile;

                reel.container.addChildAt(sym, r);
                reel.symbols[r] = sym;
                return;
            }

            const existing = current as SlotSymbol;

            if ((existing as any).type !== type) {
                existing.destroy();
                removeCurrent();

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * tile;

                reel.container.addChildAt(sym, r);
                reel.symbols[r] = sym;
                return;
            }

            existing.visible = true;
            existing.y = r * tile;
        });

        this.ensureWildLayerOnTop();
    }

    public testAnimateAllWildSymbols(positions: { row: number; column: number }[]) {
        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];

            for (const { row, column } of positions) {
                const reel: any = this.wildReels[column];
                const cell: any = reel?.symbols[row];
                if (!(cell instanceof SlotSymbol)) continue;

                if (!cell.visible) continue;
                if ((cell as any).type === 0) continue;

                list.push(cell);
            }

            return list;
        }, "wild");
    }

    private resetWildSymbolsToIdle() {
        for (let c = 0; c < this.wildReels.length; c++) {
            const reel: any = this.wildReels[c];
            if (!reel) continue;

            for (let r = 0; r < reel.symbols.length; r++) {
                const cell: any = reel.symbols[r];
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

        this.backendMultipliers = this.initGrid(rows, cols, 0);
        this.wildGrid = this.initGrid(rows, cols, 0);
        this.backendReels = gridRandomTypeReset();

        if (this.rows > 0 && this.columns > 0) {
            this.rebuildWildLayerStructureIfNeeded();
            this.applyWildGridToWildLayer();
            this.ensureWildLayerOnTop();
        }
    }
}
