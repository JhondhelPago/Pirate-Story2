import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { SlotSymbol } from "./SlotSymbol";
import { gridRandomTypeReset } from "./SlotUtility";
import { userSettings, SpinModeEnum } from "../utils/userSettings";

interface ReelColumn {
    container: Container;
    // symbols in this order:
    // [0..rows-1] = lead (spine)
    // [rows..rows+blurCount-1] = blur strip (blur sprite)
    // finish will temporarily append result segment at the end
    symbols: SlotSymbol[];
    position: number; // spin cursor for blur strip (in "symbol units")
}

export class Match3Board {
    public match3: Match3;

    public rows = 0;
    public columns = 0;
    public tileSize = 0;

    public typesMap!: Record<number, string>;

    // BACKEND RESULTS -------------------------------
    private backendReels: number[][] = [];
    private backendMultipliers: number[][] = [];

    // WILD OVERLAY (PERSISTENT) ----------------------
    private wildGrid: number[][] = [];

    // LAYERS -----------------------------------------
    public piecesContainer: Container;
    public piecesMask: Graphics;

    /**
     * ✅ SINGLE LAYER:
     * realLayer is the only layer used for spin + landing.
     * We simulate blur by using SlotSymbol.showBlurSprite()
     */
    private realLayer: Container;
    private wildLayer: Container;

    // REELS ------------------------------------------
    private realReels: ReelColumn[] = [];
    private wildReels: ReelColumn[] = [];

    // SPIN CONTROL -----------------------------------
    private ticker?: Ticker;
    private _spinning = false;

    private readonly _defaultSpinSpeed = 0.45; // "symbols per frame @ 60fps"
    private _spinSpeed = 0.45;

    // start spin sequential activation per column
    private colActive: boolean[] = [];
    private startSpinCalls: gsap.core.Tween[] = [];

    // SEGMENT CONTROL --------------------------------
    private readonly BLUR_EXTRA = 3;

    private get leadCount() {
        return this.rows;
    }
    private get blurCount() {
        return this.rows + this.BLUR_EXTRA;
    }

    private getYShowLead(offsetY: number) {
        return -offsetY;
    }
    private getYShowBlur(offsetY: number) {
        return -offsetY - this.rows * this.tileSize;
    }
    private getYStartAboveBlur(offsetY: number) {
        return -offsetY - this.rows * this.tileSize * 2;
    }

    // ✅ match finish slide duration to blur speed
    private getBlurMatchedSlideDuration(): number {
        const spin = Math.max(0.001, this._spinSpeed);
        const dur = this.rows / (spin * 60);
        return Math.min(0.6, Math.max(0.1, dur));
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

    // =========================================================================
    // SMALL HELPERS
    // =========================================================================
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

        // initial idle state: show spine grid
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
    // PUBLIC: WILD GRID SETTER
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
    // CAPTURE CURRENT DISPLAYED GRID (for lead continuity)
    // =========================================================================
    private getCurrentGridSnapshot(): { types: number[][]; mults: number[][] } {
        const types = this.initGrid(this.rows, this.columns, 0);
        const mults = this.initGrid(this.rows, this.columns, 0);

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {
                const cell = this.realReels?.[c]?.symbols?.[r];
                if (cell instanceof SlotSymbol) {
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
    // DESTROY/REBUILD (single layer)
    // =========================================================================
    private destroyAllLayers() {
        this.killLoops();

        for (const t of this.startSpinCalls) t?.kill?.();
        this.startSpinCalls = [];

        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        gsap.killTweensOf(this.realLayer);
        for (const r of this.realReels) gsap.killTweensOf(r.container);

        this.realLayer.removeChildren();
        this.destroyReels(this.realReels);
        this.realReels = [];

        this.colActive = new Array(this.columns).fill(false);

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD STRIP PER COLUMN: [LEAD spine] + [BLUR strip]
    // =========================================================================
    private buildSpinStripLayer(leadTypes: number[][], leadMults: number[][]) {
        const { offsetX, offsetY } = this.getOffsets();

        this.realLayer.removeChildren();
        this.destroyReels(this.realReels);
        this.realReels = [];

        const total = this.leadCount + this.blurCount;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = this.getYStartAboveBlur(offsetY);
            this.realLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            for (let i = 0; i < total; i++) {
                let type = 0;
                let mult = 0;

                if (i < this.leadCount) {
                    const r = i;
                    type = leadTypes[r][c];
                    mult = leadMults[r][c] ?? 0;
                } else {
                    type = this.randomType();
                    mult = 0;
                }

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = i * this.tile;

                if (i < this.leadCount) this.showSpine(sym);
                else this.showBlur(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ticker = new Ticker();
        this.ticker.add((t) => this.updateSpin(t));
        this.ticker.start();

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // SPIN UPDATE (blur segment only) - frame-rate independent
    // =========================================================================
    private updateSpin(tickerOrDelta: Ticker | number) {
        if (!this._spinning) return;

        const delta =
            typeof tickerOrDelta === "number"
                ? tickerOrDelta
                : ((tickerOrDelta as any).deltaTime ?? 1);

        const tile = this.tileSize;

        for (let c = 0; c < this.realReels.length; c++) {
            if (!this.colActive[c]) continue;

            const reel = this.realReels[c];

            reel.position += this._spinSpeed * delta;

            const start = this.leadCount;
            const totalBlur = this.blurCount;

            for (let j = 0; j < totalBlur; j++) {
                const i = start + j;
                const sym = reel.symbols[i];
                if (!sym) continue;

                let idx = (reel.position + j) % totalBlur;
                if (idx < 0) idx += totalBlur;

                sym.y = (start + idx) * tile;

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
    // START SPIN: seamless slide-down + sequential activation
    // =========================================================================
    private startSpinSeamlessSequential() {
        for (const t of this.startSpinCalls) t?.kill?.();
        this.startSpinCalls = [];

        const { offsetY } = this.getOffsets();
        const yEnd = this.getYShowBlur(offsetY);

        this.colActive = new Array(this.columns).fill(false);

        const PER_COL_DELAY = 0.07;
        const SLIDE_DUR = 0.22;

        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c]?.container;
            if (!col) continue;

            const call = gsap.delayedCall(c * PER_COL_DELAY, () => {
                this.colActive[c] = true;

                gsap.killTweensOf(col);
                gsap.to(col, {
                    y: yEnd,
                    duration: SLIDE_DUR,
                    ease: "none",
                });
            });

            this.startSpinCalls.push(call);
        }
    }

    private forceAllColumnsToBlurViewAndActive() {
        for (const t of this.startSpinCalls) t?.kill?.();
        this.startSpinCalls = [];

        const { offsetY } = this.getOffsets();
        const yEnd = this.getYShowBlur(offsetY);

        for (let c = 0; c < this.columns; c++) {
            this.colActive[c] = true;
            const col = this.realReels[c]?.container;
            if (!col) continue;
            gsap.killTweensOf(col);
            col.y = yEnd;
        }
    }

    // =========================================================================
    // BACKEND STORE/GET
    // =========================================================================
    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        this.backendReels = reels;
        this.backendMultipliers = multipliers;

        this._hasBackendResult = Array.isArray(reels) && reels.length > 0;

        if (this._spinInProgress && this._interruptRequested && this._hasBackendResult) {
            this.finishSpinInstantFromInterrupt();
        }
    }

    public getBackendReels() {
        return this.backendReels;
    }

    public getBackendMultipliers() {
        return this.backendMultipliers;
    }

    public getWildReels() {
        return this.wildGrid;
    }

    // =========================================================================
    // FINAL APPLY (STATIC 5x5 SPINE)  (used by interrupt only)
    // =========================================================================
    public applyBackendToFinalStaticGrid() {
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
    // ✅ NEW: Finalize ONE column immediately after it lands (no flick)
    // =========================================================================
    private finalizeSingleColumnFromLandedBackendSegmentInPlace(c: number) {
        const reel = this.realReels[c];
        if (!reel) return;

        const { offsetY } = this.getOffsets();
        const keepStart = this.leadCount + this.blurCount;

        if (reel.symbols.length < keepStart + this.rows) {
            // safety fallback
            return;
        }

        const col = reel.container;

        // remove lead+blur symbols
        for (let i = 0; i < keepStart; i++) {
            const s = reel.symbols[i];
            if (!s) continue;
            if (s.parent) s.parent.removeChild(s);
            (s as any)?.destroy?.();
        }

        // keep result segment only
        const result = reel.symbols.slice(keepStart, keepStart + this.rows);

        // shift into visible grid
        for (let r = 0; r < result.length; r++) {
            const s = result[r];
            s.y = r * this.tile;
            this.showSpine(s);
        }

        // commit
        reel.symbols = result;
        reel.position = 0;

        // normalize container to final grid position
        gsap.killTweensOf(col);
        col.y = -offsetY;

        // reorder children
        col.removeChildren();
        for (let r = 0; r < result.length; r++) col.addChild(result[r]);
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

    private async waitForLoopToFinishIfNeeded() {
        if (!this.animating || !this.animationGate) return;
        await this.animationGate;
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

    // =========================================================================
    // ANIMATE WINS
    // =========================================================================
    public animateWinningSymbols(wins: { row: number; column: number }[]) {
        this.startReplayLoop(() => {
            const list: SlotSymbol[] = [];
            for (const { row, column } of wins) {
                const reel = this.realReels[column];
                const symbol = reel?.symbols[row];
                if (symbol instanceof SlotSymbol) list.push(symbol);
            }
            return list;
        }, "win");
    }

    // =========================================================================
    // SPIN
    // =========================================================================
    public async startSpin(): Promise<void> {
        this._spinInProgress = true;
        this._interruptRequested = false;
        this._hasBackendResult = false;

        this._spinSpeed = this._defaultSpinSpeed;

        if (this.animating) {
            this.hasIncomingSpinTrigger = true;
            await this.waitForLoopToFinishIfNeeded();
        }

        this.killLoops();
        this.resetWildSymbolsToIdle();

        const snap = this.getCurrentGridSnapshot();

        this.destroyAllLayers();
        this.buildSpinStripLayer(snap.types, snap.mults);

        this.startSpinLoop();
        this.startSpinSeamlessSequential();

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

        this.finishSpinInstantFromInterrupt();
    }

    private finishSpinInstantFromInterrupt(): void {
        if (!this._spinInProgress) return;
        if (!this._hasBackendResult) return;

        this.killLoops();
        this.hasIncomingSpinTrigger = false;

        this.stopSpinLoop();
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

    public async finishSpin(): Promise<void> {
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
    // FINISH HELPERS
    // =========================================================================
    private appendResultSegmentBelowBlur() {
        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const col = reel.container;

            while (reel.symbols.length > this.leadCount + this.blurCount) {
                const last = reel.symbols.pop();
                (last as any)?.destroy?.();
                if (last?.parent) last.parent.removeChild(last);
            }

            const baseY = (this.leadCount + this.blurCount) * this.tile;

            // ✅ append BACKEND symbols (these will be the landing symbols)
            for (let r = 0; r < this.rows; r++) {
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = baseY + r * this.tile;
                this.showSpine(sym);

                reel.symbols.push(sym);
                col.addChild(sym);
            }
        }
    }

    /**
     * ✅ Sequential landing:
     * - other columns keep spinning
     * - the landed column becomes REAL backend 5x5 immediately (no "change at the end")
     */
    private async slideColumnsToResult(sequential: boolean, slideDur: number, between: number) {
        const { offsetY } = this.getOffsets();

        const yFrom = this.getYShowBlur(offsetY);
        const yTo = yFrom + this.rows * this.tile;

        const wait = (sec: number) =>
            new Promise<void>((resolve) => gsap.delayedCall(sec, () => resolve()));

        // align all to blur-view, all spinning
        for (let c = 0; c < this.columns; c++) {
            const col = this.realReels[c].container;
            gsap.killTweensOf(col);
            col.y = yFrom;
            this.colActive[c] = true;
        }

        if (!sequential) {
            // all land together -> stop spinning all during the landing tween
            for (let c = 0; c < this.columns; c++) this.colActive[c] = false;

            const ps: Promise<void>[] = [];
            for (let c = 0; c < this.columns; c++) {
                const col = this.realReels[c].container;
                const t = gsap.to(col, { y: yTo, duration: slideDur, ease: "none" });
                ps.push(new Promise<void>((resolve) => t.eventCallback("onComplete", () => resolve())));
            }
            await Promise.all(ps);

            // after all landed together, finalize all at once
            for (let c = 0; c < this.columns; c++) {
                this.finalizeSingleColumnFromLandedBackendSegmentInPlace(c);
            }
            return;
        }

        for (let c = 0; c < this.columns; c++) {
            // ✅ stop spinning THIS column only; others continue
            this.colActive[c] = false;

            const col = this.realReels[c].container;
            const t = gsap.to(col, { y: yTo, duration: slideDur, ease: "none" });

            await new Promise<void>((resolve) => t.eventCallback("onComplete", () => resolve()));

            // ✅ IMPORTANT: immediately convert this landed column into real backend 5x5
            // so the player sees the true result as soon as it lands.
            this.finalizeSingleColumnFromLandedBackendSegmentInPlace(c);

            if (between > 0 && c < this.columns - 1) await wait(between);
        }
    }

    /**
     * NORMAL:
     * - other columns keep spinning while one column lands
     * - landed column shows backend result immediately (no “result changed later”)
     */
    public async finishSpinNormal(): Promise<void> {
        this.forceAllColumnsToBlurViewAndActive();
        this.startSpinLoop();

        this.appendResultSegmentBelowBlur();

        const SLIDE = this.getBlurMatchedSlideDuration();
        const BETWEEN = 0.06;

        await this.slideColumnsToResult(true, SLIDE, BETWEEN);

        // after all columns finalized, stop loop (everything is already 5x5 backend)
        this.stopSpinLoop();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    /**
     * QUICK:
     * - land together
     * - backend already visible during landing
     */
    public async finishSpinQuick(): Promise<void> {
        this.forceAllColumnsToBlurViewAndActive();
        this.startSpinLoop();

        this.appendResultSegmentBelowBlur();

        const SLIDE = this.getBlurMatchedSlideDuration();
        await this.slideColumnsToResult(false, SLIDE, 0);

        this.stopSpinLoop();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    /**
     * TURBO:
     * - land together faster
     */
    public async finishSpinTurbo(): Promise<void> {
        this.forceAllColumnsToBlurViewAndActive();
        this.startSpinLoop();

        this.appendResultSegmentBelowBlur();

        const SLIDE = Math.max(0.08, this.getBlurMatchedSlideDuration() * 0.75);
        await this.slideColumnsToResult(false, SLIDE, 0);

        this.stopSpinLoop();

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    // =========================================================================
    // MULTIPLIER HELPER (your original)
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
    // WILD LAYER (unchanged)
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

    // =========================================================================
    // CLEAR
    // =========================================================================
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
