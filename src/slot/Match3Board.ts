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

    // WILD OVERLAY (PERSISTENT) ----------------------
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

    // ✅ same helper style as old board
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

    // ✅ prevent double-finishes / races
    private _interruptFinishing = false;
    private _interruptFinished = false;

    // ✅ UX: only allow interrupt once ALL columns are in blur-spinning state
    private _allColumnsSpinning = false;
    private _interruptPending = false;

    // ✅ landing awareness
    private _landingInProgress = false;

    // ✅ when interrupt happens mid sequential landing: remaining columns collapsed already
    private _landingCollapsed = false;

    // ✅ NEW: quick/quickish landing speed-up gate (Quick spin landing interrupt)
    private _accelerateLandingRequested = false;

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

        // ✅ TEST: press "I" to request an interrupt
        window.addEventListener("keydown", (e) => {
            if (e.key.toLowerCase() === "i") {
                this.interruptSpin();
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

    // ✅ like old board
    public getWildReels() {
        return this.wildGrid;
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
    // ✅ Atomic swap still used for final static grid (end-flick fix)
    // =========================================================================
    private swapRealLayer(nextLayer: Container, nextReels: ReelColumn[]) {
        const parent = this.piecesContainer;

        const oldLayer = this.realLayer;
        const oldReels = this.realReels;

        const insertIndex =
            oldLayer.parent === parent ? parent.getChildIndex(oldLayer) : Math.max(0, parent.children.length - 1);

        parent.addChildAt(nextLayer, Math.min(insertIndex, parent.children.length));

        if (oldLayer.parent === parent) parent.removeChild(oldLayer);

        this.destroyReels(oldReels);
        oldLayer.removeChildren();

        try {
            (oldLayer as any).destroy?.({ children: false });
        } catch {
            oldLayer.destroy();
        }

        this.realLayer = nextLayer;
        this.realReels = nextReels;

        this.ensureWildLayerOnTop();
    }

    /**
     * Stop timers/tweens safely without clearing the visible grid.
     */
    private prepareSpinTransitionNoClear() {
        this.killLoops();
        this.cancelStartSequence();
        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        gsap.killTweensOf(this.realLayer);
        for (const r of this.realReels) gsap.killTweensOf(r.container);

        this._spinning = false;
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

    // =========================================================================
    // ✅ APPLY WILD REEL BEHAVIOR FROM OLD BOARD (no custom merge logic)
    // =========================================================================
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
    // ✅ INJECT BLUR STRIP MID-SPIN *IN-PLACE*
    // =========================================================================
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

            // Update existing lead symbols to snapshot
            for (let r = 0; r < this.rows; r++) {
                const sym = reel.symbols[r];
                const type = leadTypes[r][c];
                const mult = leadMults[r][c] ?? 0;

                sym.setup({
                    name: this.typesMap[type],
                    type,
                    size: this.tileSize,
                    multiplier: mult,
                });
                this.showSpine(sym);
                sym.y = r * this.tile;
            }

            // Build blur symbols
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

    // =========================================================================
    // START SPIN: wave then blur-spin
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

        // ✅ wave done: all columns are in blur position and can spin
        for (let c = 0; c < this.columns; c++) this.colActive[c] = true;

        if (!this.hasSpinStripBuilt()) {
            const snap = this.getCurrentGridSnapshot();
            this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
        }

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yBlur;
            this.setBlurVisibleForColumn(c, true);
        }

        this._allColumnsSpinning = true;

        if (this._interruptPending) {
            this._interruptPending = false;
            this.tryExecuteInterruptNow();
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
    }

    // =========================================================================
    // BACKEND STORE
    // =========================================================================
    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        this.backendReels = reels;
        this.backendMultipliers = multipliers;

        this._hasBackendResult = Array.isArray(reels) && reels.length > 0;

        // ✅ Only auto-finish from interrupt if NOT in landing.
        if (
            this._spinInProgress &&
            this._interruptRequested &&
            this._hasBackendResult &&
            this._allColumnsSpinning &&
            !this._landingInProgress
        ) {
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
        this._interruptPending = false;
        this._hasBackendResult = false;

        this._interruptFinishing = false;
        this._interruptFinished = false;

        this._allColumnsSpinning = false;
        this._landingInProgress = false;
        this._landingCollapsed = false;
        this._accelerateLandingRequested = false;

        this._spinSpeed = this._defaultSpinSpeed;

        this.prepareSpinTransitionNoClear();
        this.resetWildSymbolsToIdle();

        const snap = this.getCurrentGridSnapshot();

        this.stopAndDestroyTicker();
        this.startTickerIfNeeded();
        this.startSpinLoop();

        const spinMode = userSettings.getSpinMode();

        if (spinMode === SpinModeEnum.Turbo) {
            // Turbo is too fast: ignore interrupt behavior (per your request)
            this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
            this.forceAllColumnsToBlurViewAndActive();
            this._spinSpeed = Math.max(this._spinSpeed, 1.4);
            this._startSequencePromise = null;

            this._allColumnsSpinning = true;

            // do NOT auto-run interrupt in turbo (ignored)
            this._interruptPending = false;
            this._interruptRequested = false;

            this.ensureWildLayerOnTop();
            return;
        }

        // NORMAL / QUICK:
        const WAVE_STAGGER = 0.06;
        const LIFT_DUR = 0.15;
        const DROP_DUR = 0.2;
        const totalWaveTime = (this.columns - 1) * WAVE_STAGGER + LIFT_DUR + DROP_DUR;
        const midTime = Math.max(0.06, totalWaveTime * 0.55);

        gsap.delayedCall(midTime, () => {
            this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
        });

        this._startSequencePromise = this.startSpinSeamlessSequential();
        this.ensureWildLayerOnTop();
    }

    /**
     * ✅ SAFE interrupt rules:
     * - Turbo: ignore entirely (too fast)
     * - During lift wave (before all columns spinning): arm only (except landing)
     * - During landing (Quick/Normal): accelerate landing (no null-y errors)
     * - After all columns spinning: trigger immediately
     */
    public interruptSpin(): void {
        if (!this._spinInProgress) return;
        if (this._interruptFinished) return;

        const spinMode = userSettings.getSpinMode();

        // ✅ Turbo: ignore
        if (spinMode === SpinModeEnum.Turbo) return;

        // ✅ If landing already in progress: request faster landing
        if (this._landingInProgress) {
            this._interruptRequested = true;
            this._accelerateLandingRequested = true; // ✅ tells lander to speed up
            return;
        }

        // Too early: arm only
        if (!this._allColumnsSpinning) {
            this._interruptRequested = true;
            this._interruptPending = true;
            return;
        }

        // Safe now
        this._interruptRequested = true;
        this.tryExecuteInterruptNow();
    }

    private tryExecuteInterruptNow(): void {
        if (!this._spinInProgress) return;
        if (this._interruptFinished) return;

        // during spin phase, ensure UX state
        if (!this._allColumnsSpinning && !this._landingInProgress) return;

        if (!this.hasSpinStripBuilt()) {
            const snap = this.getCurrentGridSnapshot();
            this.buildSpinStripIntoCurrentLayer(snap.types, snap.mults);
        }

        this.forceAllColumnsToBlurViewAndActive();

        this._spinSpeed = Math.max(this._spinSpeed, 1.8);
        this.startSpinLoop();

        if (this._hasBackendResult) {
            void this.finishSpinInstantFromInterruptAsync();
        }
    }

    private async waitForWinningPositionsReady(maxMs = 500): Promise<void> {
        const t0 = performance.now();
        while (performance.now() - t0 < maxMs) {
            const wins = this.match3.process.getWinningPositions();
            if (wins && wins.length >= 0) return;
            await this.sleep(16);
        }
    }

    private async waitForBackendReady(): Promise<void> {
        while (!this._hasBackendResult) {
            await this.sleep(16);
        }
    }

    private finalizeAfterInterruptNoLanding(): void {
        this.cancelStartSequence();
        this.stopSpinLoop();
        this.stopAndDestroyTicker();

        this.applyBackendToFinalStaticGrid();
        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);

        this._spinSpeed = this._defaultSpinSpeed;

        this._interruptFinished = true;
        this._interruptFinishing = false;
        this._spinInProgress = false;
        this._interruptRequested = false;
        this._accelerateLandingRequested = false;
    }

    private async finishSpinInstantFromInterruptAsync(): Promise<void> {
        if (!this._spinInProgress) return;
        if (!this._hasBackendResult) return;
        if (this._interruptFinishing || this._interruptFinished) return;

        // If landing already running, do not fight it.
        if (this._landingInProgress) return;

        // If sequential landing already collapsed remaining columns, do NOT land again.
        if (this._landingCollapsed) {
            this.finalizeAfterInterruptNoLanding();
            return;
        }

        // Must be in safe post-wave state
        if (!this._allColumnsSpinning) return;

        this._interruptFinishing = true;

        await this.waitForWinningPositionsReady(600);

        this.cancelStartSequence();
        this._startSequencePromise = null;

        // Ensure blur view
        this.forceAllColumnsToBlurViewAndActive();

        // Super fast land (instant-feel)
        await this.landColumnsAllAtOnce({
            slideDur: 0.08,
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

        this._spinSpeed = this._defaultSpinSpeed;

        this._interruptFinished = true;
        this._interruptFinishing = false;
        this._spinInProgress = false;
        this._interruptRequested = false;
    }

    public async finishSpin(): Promise<void> {
        if (this._interruptFinished) return;

        if (this._startSequencePromise) {
            await this._startSequencePromise;
        }

        await this.waitForBackendReady();

        // If interrupt requested and not in landing, do fast finisher.
        if (this._interruptRequested && !this._landingInProgress) {
            await this.finishSpinInstantFromInterruptAsync();
            return;
        }

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
            this.showSpine(sym);
            sym.y = r * this.tile;
        }
    }

    private async landRemainingColumnsAllAtOnce(remainingCols: number[]): Promise<void> {
        if (!remainingCols.length) return;

        const { offsetY } = this.getOffsets();
        const yLead = -offsetY;
        const yBlur = -offsetY + this.rows * this.tile;
        const yFromTop = yLead - this.rows * this.tile;

        const SLIDE_DUR = 0.08;

        const dropLayer = new Container();
        this.realLayer.addChild(dropLayer);
        this.realLayer.setChildIndex(dropLayer, this.realLayer.children.length - 1);

        const dropCols: Container[] = [];
        const leadSymsByCol: Record<number, SlotSymbol[]> = {};

        for (const c of remainingCols) {
            const col = this.realReels[c]?.container as any;
            if (!col || col?.destroyed) continue;

            gsap.killTweensOf(col);
            col.y = yBlur;

            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        for (const c of remainingCols) {
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
            t.eventCallback("onComplete", () => resolve());
        });

        for (const c of remainingCols) {
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
            const col = this.realReels[c]?.container as any;
            if (!col || col?.destroyed) continue;

            gsap.killTweensOf(col);
            col.y = yBlur;

            this.colActive[c] = true;
            this.setBlurVisibleForColumn(c, true);
        }

        for (let c = 0; c < this.columns; c++) {
            if (this._interruptRequested) {
                const remaining: number[] = [];
                for (let k = c; k < this.columns; k++) remaining.push(k);

                for (const k of remaining) {
                    const col = this.realReels[k]?.container as any;
                    if (!col || col?.destroyed) continue;
                    gsap.killTweensOf(col);
                }

                await this.landRemainingColumnsAllAtOnce(remaining);
                this._landingCollapsed = true;
                break;
            }

            const reel = this.realReels[c];
            const col = reel?.container as any;
            if (!reel || !col || col?.destroyed) continue;

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
            });

            if (c < this.columns - 1 && BETWEEN > 0) {
                await new Promise<void>((resolve) => gsap.delayedCall(BETWEEN, () => resolve()));
            }
        }

        dropLayer.removeChildren();
        dropLayer.destroy();
    }

    /**
     * ✅ FIXED for Quick-spin interrupt during landing:
     * - If interrupt happens mid landing, we *accelerate* the in-flight tween instead of re-entering landing.
     * - Prevents "Cannot set properties of null (setting 'y')" by never touching destroyed/cleared containers.
     */
    private async landColumnsAllAtOnce(opts?: {
        slideDur?: number;
        bouncePx?: number;
        bounceDownDur?: number;
        bounceUpDur?: number;
    }): Promise<void> {
        const baseSlide = opts?.slideDur ?? 0.26;

        // ✅ if interrupt requested during landing, land faster
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

        // Put all columns at blur
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

        // ✅ If user interrupts during landing, we can speed up by killing & snapping mid-flight safely
        // (but we only do that AFTER the tween exists; here we just pick a smaller duration)
        await new Promise<void>((resolve) => {
            const t = gsap.to(dropCols, { y: yLead, duration: SLIDE_DUR, ease: "none" });
            t.eventCallback("onComplete", () => resolve());
        });

        // Reattach leads back to columns
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

        // Cleanup
        for (const dc of dropCols) {
            dc.removeChildren();
            dc.destroy();
        }
        dropLayer.removeChildren();
        dropLayer.destroy();

        // Optional bounce
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
            });
        }

        // ✅ Clear accelerate flag after landing completes
        this._accelerateLandingRequested = false;
    }

    // =========================================================================
    // FINAL APPLY (STATIC 5x5) - built then swapped
    // =========================================================================
    public applyBackendToFinalStaticGrid() {
        this.cancelStartSequence();
        this.stopAndDestroyTicker();

        const { offsetX, offsetY } = this.getOffsets();

        const nextLayer = new Container();
        const nextReels: ReelColumn[] = [];

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            nextLayer.addChild(col);

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

            nextReels.push(reel);
        }

        this.swapRealLayer(nextLayer, nextReels);
        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // FINISH
    // =========================================================================
    public async finishSpinNormal(): Promise<void> {
        if (this._interruptRequested && !this._landingInProgress) {
            await this.waitForBackendReady();
            await this.finishSpinInstantFromInterruptAsync();
            return;
        }

        this._landingInProgress = true;
        try {
            await this.landColumnsSequential();
        } finally {
            this._landingInProgress = false;
        }

        if (this._interruptRequested) {
            await this.waitForBackendReady();
            this.finalizeAfterInterruptNoLanding();
            return;
        }

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
        // ✅ If interrupt is requested BEFORE landing starts: do fast finisher
        if (this._interruptRequested && !this._landingInProgress) {
            await this.waitForBackendReady();
            await this.finishSpinInstantFromInterruptAsync();
            return;
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

        // ✅ If interrupt happened DURING landing: we already accelerated landing.
        // Just finalize (no extra landing).
        if (this._interruptRequested) {
            this.finalizeAfterInterruptNoLanding();
            return;
        }

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
        // Turbo ignores interrupts
        this._interruptRequested = false;

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
    // ✅ WILD LAYER (COPIED BEHAVIOR FROM OLD BOARD)
    // =========================================================================
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

        this.forEachCell((r, c) => {
            const reel = this.wildReels[c];
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

                const dummy = this.makeDummyCell(r * tile);
                reel.container.addChildAt(dummy, r);
                reel.symbols[r] = dummy as any;
                return;
            }

            if (!(current instanceof SlotSymbol)) {
                removeCurrent();

                const sym = this.makeSlotSymbol(type, mult);
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
                sym.y = r * tile;

                this.showSpine(sym);

                reel.container.addChildAt(sym, r);
                reel.symbols[r] = sym as any;
                return;
            }

            existing.visible = true;
            existing.y = r * tile;
            this.showSpine(existing);
        });

        this.ensureWildLayerOnTop();
    }

    public testAnimateAllWildSymbols(positions: { row: number; column: number }[]) {
        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];

            for (const { row, column } of positions) {
                const reel = this.wildReels[column] as any;
                const cell = reel?.symbols[row];
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
