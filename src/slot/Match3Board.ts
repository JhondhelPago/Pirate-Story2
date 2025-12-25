import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";
import { gridRandomTypeReset } from "./SlotUtility";
import { userSettings, SpinModeEnum } from "../utils/userSettings";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
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
     * blurLayer is a "BLUR COLUMNS LAYER" that stays inside the mask area and spins.
     * realLayer is the 5x5 real result layer.
     */
    private blurLayer: Container;
    private realLayer: Container;
    private wildLayer: Container;

    // REELS ------------------------------------------
    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];
    private wildReels: ReelColumn[] = [];

    // NEW: per-column blur freeze (so landed columns stop while others keep spinning)
    private blurFrozen: boolean[] = [];

    // SPIN CONTROL -----------------------------------
    private ticker?: Ticker;
    private _blurSpinning = false;

    // ✅ keep a default speed so we can restore it
    private readonly _defaultBlurSpinSpeed = 0.45;
    private _blurSpinSpeed = 0.45;

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

    private createBlur(): BlurSymbol {
        const types = Object.keys(this.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.tileSize);
    }

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesMask = new Graphics();

        this.piecesContainer = new Container();
        this.piecesContainer.mask = this.piecesMask;

        this.match3.addChild(this.piecesContainer);
        this.match3.addChild(this.piecesMask);

        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.backendMultipliers = this.initGrid(5, 5, 0);
        this.wildGrid = this.initGrid(5, 5, 0);

        this.wildLayer = new Container();

        this.piecesContainer.addChild(this.blurLayer);
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

        this.buildInitialRealLayer();

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
    // INITIAL REAL LAYER
    // =========================================================================
    private buildInitialRealLayer() {
        const { offsetX, offsetY } = this.getOffsets();

        this.realLayer.removeChildren();
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

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // DESTROY/REBUILD BLUR+REAL (WILD STAYS)
    // =========================================================================
    private destroyAllLayers() {
        this.killLoops();

        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        for (const r of this.realReels) gsap.killTweensOf(r.container);
        for (const r of this.blurReels) gsap.killTweensOf(r.container);

        this.destroyReels(this.blurReels);
        this.blurReels = [];
        this.blurLayer.removeChildren();

        this.destroyReels(this.realReels);
        this.realReels = [];
        this.realLayer.removeChildren();

        if (this.blurLayer.parent) this.blurLayer.parent.removeChild(this.blurLayer);
        if (this.realLayer.parent) this.realLayer.parent.removeChild(this.realLayer);

        this.blurLayer = new Container();
        this.realLayer = new Container();

        const wildIndex = this.piecesContainer.children.indexOf(this.wildLayer);
        const insertIndex = wildIndex >= 0 ? wildIndex : this.piecesContainer.children.length;

        this.piecesContainer.addChildAt(
            this.blurLayer,
            Math.min(insertIndex, this.piecesContainer.children.length)
        );

        const wildIndex2 = this.piecesContainer.children.indexOf(this.wildLayer);
        const insertIndex2 = wildIndex2 >= 0 ? wildIndex2 : this.piecesContainer.children.length;

        this.piecesContainer.addChildAt(
            this.realLayer,
            Math.min(insertIndex2, this.piecesContainer.children.length)
        );

        // reset freeze states
        this.blurFrozen = new Array(this.columns).fill(false);

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD BLUR "COLUMNS" LAYER (spinning)
    // =========================================================================
    private buildBlurLayer() {
        const { offsetX, offsetY } = this.getOffsets();

        this.blurFrozen = new Array(this.columns).fill(false);

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY - this.tile;
            col.visible = true;
            this.blurLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            const total = this.rows + 3;
            for (let i = 0; i < total; i++) {
                const blur = this.createBlur();
                blur.y = i * this.tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.blurReels.push(reel);
        }

        this.ticker = new Ticker();
        this.ticker.add(() => this.updateBlurSpin());
        this.ticker.start();

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD REAL LAYER (placeholder blur during spin)
    // =========================================================================
    private buildRealLayer() {
        const { offsetX, offsetY } = this.getOffsets();

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            for (let r = 0; r < this.rows; r++) {
                const blur = this.createBlur();
                blur.y = r * this.tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BLUR SPIN UPDATE (skip frozen columns)
    // =========================================================================
    private updateBlurSpin() {
        if (!this._blurSpinning) return;

        const tile = this.tileSize;

        for (let c = 0; c < this.blurReels.length; c++) {
            if (this.blurFrozen[c]) continue;

            const reel = this.blurReels[c];
            reel.position += this._blurSpinSpeed;
            const total = reel.symbols.length;

            for (let i = 0; i < total; i++) {
                const sym = reel.symbols[i];
                const idx = (reel.position + i) % total;
                sym.y = idx * tile;
            }
        }
    }

    private startBlurSpin() {
        this._blurSpinning = true;
    }
    private stopBlurSpin() {
        this._blurSpinning = false;
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
    // APPLY BACKEND RESULT TO REAL REELS
    // =========================================================================
    public applyBackendToRealLayer() {
        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];

            for (const sym of reel.symbols) (sym as any)?.destroy?.();
            reel.symbols = [];
            reel.container.removeChildren();

            for (let r = 0; r < this.rows; r++) {
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * this.tile;

                reel.symbols.push(sym);
                reel.container.addChild(sym);
            }
        }

        this.ensureWildLayerOnTop();
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

        // ✅ reset speed every new spin
        this._blurSpinSpeed = this._defaultBlurSpinSpeed;

        if (this.animating) {
            this.hasIncomingSpinTrigger = true;
            await this.waitForLoopToFinishIfNeeded();
        }

        this.killLoops();
        this.resetWildSymbolsToIdle();

        this.destroyAllLayers();
        this.buildBlurLayer();
        this.buildRealLayer();

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        this.blurLayer.y = 0;
        this.realLayer.y = this.maskH;

        // reset per-column states
        this.blurFrozen = new Array(this.columns).fill(false);
        for (let c = 0; c < this.blurReels.length; c++) {
            this.blurReels[c].container.visible = true;
        }

        this.ensureWildLayerOnTop();

        this.startBlurSpin();
    }

    public interruptSpin(): void {
        if (!this._spinInProgress) return;

        this._interruptRequested = true;

        if (!this._hasBackendResult) {
            this._blurSpinSpeed = Math.max(this._blurSpinSpeed, 1.2);
            this.startBlurSpin();
            return;
        }

        this.finishSpinInstantFromInterrupt();
    }

    private finishSpinInstantFromInterrupt(): void {
        if (!this._spinInProgress) return;
        if (!this._hasBackendResult) return;

        this.killLoops();
        this.hasIncomingSpinTrigger = false;

        // stop all blur now
        this.stopBlurSpin();

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        for (const r of this.realReels) gsap.killTweensOf(r.container);
        for (const r of this.blurReels) gsap.killTweensOf(r.container);

        this.applyBackendToRealLayer();

        // instantly show real
        this.realLayer.y = 0;

        // instantly hide blur
        this.blurLayer.y = -this.maskH - this.tileSize * 3;

        // normalize columns
        const { offsetY } = this.getOffsets();
        for (const reel of this.realReels) {
            reel.container.y = -offsetY;
        }

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);

        this._blurSpinSpeed = this._defaultBlurSpinSpeed;

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

        this._blurSpinSpeed = this._defaultBlurSpinSpeed;

        this._spinInProgress = false;
        this._interruptRequested = false;
    }

   
public async finishSpinNormal(): Promise<void> {
    // ✅ HIDE real layer while we rebuild symbols to prevent 1-frame flick
    this.realLayer.visible = false;

    this.applyBackendToRealLayer();

    const { offsetY } = this.getOffsets();

    this.realLayer.y = this.maskH;
    this.blurLayer.y = 0;

    const fallDistance = this.tileSize * (this.rows + 2);

    // -----------------------------
    // SPEED TUNING (NORMAL)
    // -----------------------------
    const SLIDE_IN = 0.26;          // was 0.18 (slower transition)
    const DROP = 0.30;              // was 0.35 (slower landing)
    const START_DELAY = 0.22;       // was 0.18 (more time before first drop)
    const BETWEEN_COLS = 0.06;      // was 0.03 (more cadence)
    const BLUR_FADE = 0.16;         // was 0.12 (slower blur fade)
    const FADE_AT = 0.72;           // was 0.70 (fade a bit later)
    const BLUR_OUT = 0.26;          // was 0.20 (slower blur exit)

    const wait = (sec: number) =>
        new Promise<void>((resolve) => gsap.delayedCall(sec, () => resolve()));

    // Reset blur states
    for (let c = 0; c < this.columns; c++) {
        const blurCol = this.blurReels[c]?.container;
        if (blurCol) {
            blurCol.visible = true;
            blurCol.alpha = 1;
        }
        this.blurFrozen[c] = false;
    }

    // ✅ Place ALL real columns above AND keep them hidden initially
    for (let c = 0; c < this.realReels.length; c++) {
        const col = this.realReels[c].container;
        gsap.killTweensOf(col);
        col.y = -offsetY - fallDistance;
        col.visible = false;
    }

    // ✅ Now that everything is positioned, show the layer (columns still hidden)
    this.realLayer.visible = true;

    // Slide real layer into view (no bounce)
    gsap.killTweensOf(this.realLayer);
    const slideInTween = gsap.to(this.realLayer, {
        y: 0,
        duration: SLIDE_IN,
        ease: "none",
    });

    await new Promise<void>((resolve) => {
        slideInTween.eventCallback("onComplete", () => resolve());
    });

    if (START_DELAY > 0) await wait(START_DELAY);

    for (let c = 0; c < this.columns; c++) {
        const reel = this.realReels[c];
        const blurCol = this.blurReels[c]?.container;

        // ✅ reveal THIS column only when it's about to fall
        reel.container.visible = true;

        // Fade + freeze blur column near landing
        gsap.delayedCall(DROP * FADE_AT, () => {
            if (!blurCol) return;

            gsap.killTweensOf(blurCol);
            gsap.to(blurCol, {
                alpha: 0,
                duration: BLUR_FADE,
                ease: "none",
                onComplete: () => {
                    this.blurFrozen[c] = true;
                    blurCol.visible = false;
                    blurCol.alpha = 1;
                },
            });
        });

        const t = gsap.to(reel.container, {
            y: -offsetY,
            duration: DROP,
            ease: "none",
        });

        await new Promise<void>((resolve) => {
            t.eventCallback("onComplete", () => resolve());
        });

        if (BETWEEN_COLS > 0 && c < this.columns - 1) {
            await wait(BETWEEN_COLS);
        }
    }

    // After all columns landed, stop blur and move it away
    this.stopBlurSpin();

    gsap.killTweensOf(this.blurLayer);
    const blurOut = gsap.to(this.blurLayer, {
        y: -this.maskH - this.tileSize * 3,
        duration: BLUR_OUT,
        ease: "none",
    });

    await new Promise<void>((resolve) => {
        blurOut.eventCallback("onComplete", () => resolve());
    });

    this.ensureWildLayerOnTop();

    const wins = this.match3.process.getWinningPositions() ?? [];
    this.animateWinningSymbols(wins);

    this.setWildReels(this.match3.process.getWildReels());
    this.testAnimateAllWildSymbols(wins);
}


/**
 * QUICK:
 * - Same "switch blur -> real columns" logic as NORMAL
 * - ALL 5 columns drop and land at the SAME time
 * - NO bounce, NO flick
 */
public async finishSpinQuick(): Promise<void> {
    this.realLayer.visible = false;

    this.applyBackendToRealLayer();

    const { offsetY } = this.getOffsets();

    this.realLayer.y = this.maskH;
    this.blurLayer.y = 0;

    const fallDistance = this.tileSize * (this.rows + 2);

    // -----------------------------
    // SPEED TUNING (QUICK)
    // -----------------------------
    const SLIDE_IN = 0.24;          // was 0.16
    const DROP = 0.30;              // was 0.28
    const BLUR_FADE = 0.14;         // was 0.10
    const FADE_AT = 0.70;           // same idea as normal
    const BLUR_OUT = 0.22;          // was 0.18

    // Reset blur states (all spinning)
    for (let c = 0; c < this.columns; c++) {
        const blurCol = this.blurReels[c]?.container;
        if (blurCol) {
            blurCol.visible = true;
            blurCol.alpha = 1;
        }
        this.blurFrozen[c] = false;
    }

    // Place ALL real columns above and keep hidden until switch
    for (let c = 0; c < this.realReels.length; c++) {
        const col = this.realReels[c].container;
        gsap.killTweensOf(col);
        col.y = -offsetY - fallDistance;
        col.visible = false;
    }

    this.realLayer.visible = true;

    gsap.killTweensOf(this.realLayer);
    const slideInTween = gsap.to(this.realLayer, {
        y: 0,
        duration: SLIDE_IN,
        ease: "none",
    });

    await new Promise<void>((resolve) => slideInTween.eventCallback("onComplete", () => resolve()));

    // SWITCH moment: reveal all 5 real columns at once
    for (let c = 0; c < this.columns; c++) {
        this.realReels[c].container.visible = true;
    }

    // Fade+freeze ALL blur columns near landing (same time)
    gsap.delayedCall(DROP * FADE_AT, () => {
        for (let c = 0; c < this.columns; c++) {
            const blurCol = this.blurReels[c]?.container;
            if (!blurCol) continue;

            gsap.killTweensOf(blurCol);
            gsap.to(blurCol, {
                alpha: 0,
                duration: BLUR_FADE,
                ease: "none",
                onComplete: () => {
                    this.blurFrozen[c] = true;
                    blurCol.visible = false;
                    blurCol.alpha = 1;
                },
            });
        }
    });

    // Drop ALL columns together (no bounce)
    const drops: Promise<void>[] = [];
    for (let c = 0; c < this.columns; c++) {
        const t = gsap.to(this.realReels[c].container, {
            y: -offsetY,
            duration: DROP,
            ease: "none",
        });
        drops.push(new Promise<void>((resolve) => t.eventCallback("onComplete", () => resolve())));
    }

    await Promise.all(drops);

    this.stopBlurSpin();

    gsap.killTweensOf(this.blurLayer);
    const blurOut = gsap.to(this.blurLayer, {
        y: -this.maskH - this.tileSize * 3,
        duration: BLUR_OUT,
        ease: "none",
    });

    await new Promise<void>((resolve) => blurOut.eventCallback("onComplete", () => resolve()));

    this.ensureWildLayerOnTop();

    const wins = this.match3.process.getWinningPositions() ?? [];
    this.animateWinningSymbols(wins);

    this.setWildReels(this.match3.process.getWildReels());
    this.testAnimateAllWildSymbols(wins);
}


/**
 * TURBO:
 * - Same as QUICK but faster (still not "too fast")
 * - ALL 5 columns land at the SAME time
 * - NO bounce, NO flick
 */
public async finishSpinTurbo(): Promise<void> {
    this.realLayer.visible = false;

    this.applyBackendToRealLayer();

    const { offsetY } = this.getOffsets();

    this.realLayer.y = this.maskH;
    this.blurLayer.y = 0;

    const fallDistance = this.tileSize * (this.rows + 2);

    // -----------------------------
    // SPEED TUNING (TURBO)
    // -----------------------------
    const SLIDE_IN = 0.16;          // was 0.10 (slower than before)
    const DROP = 0.20;              // was 0.18
    const BLUR_FADE = 0.10;         // was 0.08
    const FADE_AT = 0.70;
    const BLUR_OUT = 0.16;          // was 0.12

    // Reset blur states (all spinning)
    for (let c = 0; c < this.columns; c++) {
        const blurCol = this.blurReels[c]?.container;
        if (blurCol) {
            blurCol.visible = true;
            blurCol.alpha = 1;
        }
        this.blurFrozen[c] = false;
    }

    // Place ALL real columns above and keep hidden until switch
    for (let c = 0; c < this.realReels.length; c++) {
        const col = this.realReels[c].container;
        gsap.killTweensOf(col);
        col.y = -offsetY - fallDistance;
        col.visible = false;
    }

    this.realLayer.visible = true;

    gsap.killTweensOf(this.realLayer);
    const slideInTween = gsap.to(this.realLayer, {
        y: 0,
        duration: SLIDE_IN,
        ease: "none",
    });

    await new Promise<void>((resolve) => slideInTween.eventCallback("onComplete", () => resolve()));

    // SWITCH moment: reveal all 5 real columns at once
    for (let c = 0; c < this.columns; c++) {
        this.realReels[c].container.visible = true;
    }

    // Fade+freeze ALL blur columns near landing (same time)
    gsap.delayedCall(DROP * FADE_AT, () => {
        for (let c = 0; c < this.columns; c++) {
            const blurCol = this.blurReels[c]?.container;
            if (!blurCol) continue;

            gsap.killTweensOf(blurCol);
            gsap.to(blurCol, {
                alpha: 0,
                duration: BLUR_FADE,
                ease: "none",
                onComplete: () => {
                    this.blurFrozen[c] = true;
                    blurCol.visible = false;
                    blurCol.alpha = 1;
                },
            });
        }
    });

    // Drop ALL columns together (no bounce)
    const drops: Promise<void>[] = [];
    for (let c = 0; c < this.columns; c++) {
        const t = gsap.to(this.realReels[c].container, {
            y: -offsetY,
            duration: DROP,
            ease: "none",
        });
        drops.push(new Promise<void>((resolve) => t.eventCallback("onComplete", () => resolve())));
    }

    await Promise.all(drops);

    this.stopBlurSpin();

    gsap.killTweensOf(this.blurLayer);
    const blurOut = gsap.to(this.blurLayer, {
        y: -this.maskH - this.tileSize * 3,
        duration: BLUR_OUT,
        ease: "none",
    });

    await new Promise<void>((resolve) => blurOut.eventCallback("onComplete", () => resolve()));

    this.ensureWildLayerOnTop();

    const wins = this.match3.process.getWinningPositions() ?? [];
    this.animateWinningSymbols(wins);

    this.setWildReels(this.match3.process.getWildReels());
    this.testAnimateAllWildSymbols(wins);
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
            const reel = this.wildReels[c];
            if (!reel) return;

            const current = reel.symbols[r];
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
                const reel = this.wildReels[column];
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
            const reel = this.wildReels[c];
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
