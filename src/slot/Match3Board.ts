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

    private blurLayer: Container;
    private realLayer: Container;
    private wildLayer: Container;

    // REELS ------------------------------------------
    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];
    private wildReels: ReelColumn[] = [];

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

    private makeDummyCell(y: number) {
        const dummy = new Container() as any;
        dummy.y = y;
        dummy.visible = false;
        return dummy;
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

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD BLUR LAYER
    // =========================================================================
    private buildBlurLayer() {
        const { offsetX, offsetY } = this.getOffsets();

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY - this.tile;
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
    // BLUR SPIN UPDATE
    // =========================================================================
    private updateBlurSpin() {
        if (!this._blurSpinning) return;

        const tile = this.tileSize;

        for (const reel of this.blurReels) {
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

    // ✅ helper: build a brand-new layer from backend (for Turbo swap illusion)
    private buildBackendLayer(targetLayer: Container): ReelColumn[] {
        const { offsetX, offsetY } = this.getOffsets();
        const reels: ReelColumn[] = [];

        targetLayer.removeChildren();

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * this.tile - offsetX;
            col.y = -offsetY;
            targetLayer.addChild(col);

            const reel: ReelColumn = { container: col, symbols: [], position: 0 };

            for (let r = 0; r < this.rows; r++) {
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];

                const sym = this.makeSlotSymbol(type, mult);
                sym.y = r * this.tile;

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            reels.push(reel);
        }

        return reels;
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

        this.blurLayer.y = -this.maskH;
        this.realLayer.y = 0;

        this.ensureWildLayerOnTop();

        await Promise.all([
            gsap.to(this.realLayer, { y: this.maskH, duration: 0.2, ease: "power0.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.2, ease: "power0.out" }),
        ]);

        this.startBlurSpin();
    }

    public interruptSpin(): void {
        if (!this._spinInProgress) return;

        this._interruptRequested = true;

        if (!this._hasBackendResult) {
            // speed-up illusion only while waiting
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

        this.stopBlurSpin();

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        for (const r of this.realReels) gsap.killTweensOf(r.container);
        for (const r of this.blurReels) gsap.killTweensOf(r.container);

        this.applyBackendToRealLayer();

        this.blurLayer.y = this.maskH + this.tileSize * 3;
        this.realLayer.y = 0;

        const { offsetY } = this.getOffsets();
        for (const reel of this.realReels) {
            reel.container.y = -offsetY;
        }

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);

        // ✅ restore speed so next spin starts normal
        this._blurSpinSpeed = this._defaultBlurSpinSpeed;

        this._spinInProgress = false;
        this._interruptRequested = false;
    }

    public async finishSpin(): Promise<void> {
        const spinMode = userSettings.getSpinMode();

        if (spinMode === SpinModeEnum.Normal) {
            await this.finishSpinNormal();
        } else if (spinMode === SpinModeEnum.Quick) {
            await this.finishSpinQuick(); // ✅ renamed
        } else if (spinMode === SpinModeEnum.Turbo) {
            await this.finishSpinTurbo(); // ✅ new turbo animation
        } else {
            // fallback (just in case)
            await this.finishSpinQuick();
        }

        // ✅ restore speed so next spin starts normal (in case you changed it)
        this._blurSpinSpeed = this._defaultBlurSpinSpeed;

        this._spinInProgress = false;
        this._interruptRequested = false;
    }

    // =========================================================================
    // FINISH SPIN ANIMATIONS
    // =========================================================================
    public async finishSpinNormal(): Promise<void> {
        this.stopBlurSpin();
        this.applyBackendToRealLayer();

        const { offsetY } = this.getOffsets();

        const startLayerY = this.realLayer.y;
        const columnTweens: Promise<void>[] = [];

        if (startLayerY !== 0) {
            for (const reel of this.realReels) {
                reel.container.y += startLayerY;
            }
            this.realLayer.y = 0;
        }

        const baseDuration = 0.35;
        const perColumnDelay = 0.06;

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];
            const colContainer = reel.container;
            const delay = c * perColumnDelay;

            const tween = gsap.to(colContainer, {
                y: -offsetY,
                duration: baseDuration,
                delay,
                ease: "power2.out",
            });

            columnTweens.push(
                new Promise<void>((resolve) => {
                    tween.eventCallback("onComplete", () => resolve());
                })
            );
        }

        const blurTweenDuration = baseDuration + (this.columns - 1) * perColumnDelay;

        const blurTween = gsap.to(this.blurLayer, {
            y: this.maskH + this.tileSize * 3,
            duration: blurTweenDuration,
            ease: "power2.out",
        });

        const blurPromise = new Promise<void>((resolve) => {
            blurTween.eventCallback("onComplete", () => resolve());
        });

        await Promise.all([...columnTweens, blurPromise]);

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    // ✅ renamed from finishSpinQuickTurbo -> finishSpinQuick
    public async finishSpinQuick(): Promise<void> {
        this.stopBlurSpin();
        this.applyBackendToRealLayer();

        await Promise.all([
            gsap.to(this.blurLayer, {
                y: this.maskH + this.tileSize * 3,
                duration: 0.35,
                ease: "power2.out",
            }),
            gsap.to(this.realLayer, {
                y: 0,
                duration: 0.35,
                ease: "power2.out",
            }),
        ]);

        this.ensureWildLayerOnTop();

        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);

        this.setWildReels(this.match3.process.getWildReels());
        this.testAnimateAllWildSymbols(wins);
    }

    public async finishSpinTurbo(): Promise<void> {
        this.stopBlurSpin();
        this.applyBackendToRealLayer();

        // Turbo = Quick, but slightly faster
        const d = 0.15;

        await Promise.all([
            gsap.to(this.blurLayer, {
                y: this.maskH + this.tileSize * 3,
                duration: d,
                ease: "power2.out",
            }),
            gsap.to(this.realLayer, {
                y: 0,
                duration: d,
                ease: "power2.out",
            }),
        ]);

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
