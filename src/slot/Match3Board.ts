import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { pool } from "../utils/pool";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";

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

    // LAYERS -----------------------------------------
    public piecesContainer: Container;
    public piecesMask: Graphics;

    private blurLayer: Container;
    private realLayer: Container;

    // REELS ------------------------------------------
    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];

    // SPIN CONTROL -----------------------------------
    private ticker?: Ticker;
    private _blurSpinning = false;
    private _blurSpinSpeed = 0.55;
    private initialReels: number[][] = [];
    private initialMultipliers: number[][] = [];
    


    constructor(match3: Match3) {
        this.match3 = match3;

        // Mask (will be refreshed on setup)
        this.piecesMask = new Graphics();

        // Main container
        this.piecesContainer = new Container();
        this.piecesContainer.mask = this.piecesMask;

        // Add to Match3 root
        this.match3.addChild(this.piecesContainer);
        this.match3.addChild(this.piecesMask);

        // Layers
        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.piecesContainer.addChild(this.blurLayer);
        this.piecesContainer.addChild(this.realLayer);
    }

    // =========================================================================
    // UPDATE MASK TO FIT BOARD EXACTLY
    // =========================================================================
    private refreshMask() {
        const w = this.columns * this.tileSize;
        const h = this.rows * this.tileSize;

        const offsetX = w / 2;
        const offsetY = h / 2;

        this.piecesMask.clear();
        this.piecesMask.beginFill(0xffffff, 1);

        // Mask aligned with the centered grid:
        // x: -offsetX → +offsetX
        // y: -offsetY → +offsetY
        this.piecesMask.drawRect(-offsetX, -offsetY, w, h);

        this.piecesMask.endFill();
    }

    // =========================================================================
    // SETUP BOARD
    // =========================================================================
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        const blocks = slotGetBlocks();
        this.typesMap = {};
        for (const b of blocks) this.typesMap[b.type] = b.symbol;

        // Generate random initial board if none provided
        if (this.initialReels.length === 0) {
            this.initialReels = [];
            this.initialMultipliers = [];

            const types = Object.keys(this.typesMap).map(Number);

            for (let r = 0; r < this.rows; r++) {
                this.initialReels[r] = [];
                this.initialMultipliers[r] = [];
                for (let c = 0; c < this.columns; c++) {
                    this.initialReels[r][c] = types[Math.floor(Math.random() * types.length)];
                    this.initialMultipliers[r][c] = 0;
                }
            }
        }

        this.refreshMask();

        // build initial visible board
        this.buildInitialRealLayer();
    }


    public setInitialReels(reels: number[][], multipliers: number[][]) {
        this.initialReels = reels;
        this.initialMultipliers = multipliers;
    }


    private buildInitialRealLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        this.realLayer.removeChildren();
        this.realReels = [];

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0
            };

            for (let r = 0; r < this.rows; r++) {
                const type = this.initialReels[r][c];
                const mult = this.initialPieceMutliplier(this.initialReels[r][c]);
                const name = this.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier: mult });  // <-- MULTIPLIER APPLIED
                sym.y = r * tile;

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }
    }

    // =========================================================================
    // REBUILD LAYERS BEFORE SPIN
    // =========================================================================
    private destroyAllLayers() {
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        for (const reel of this.blurReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.blurReels = [];
        this.blurLayer.removeChildren();

        for (const reel of this.realReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.realReels = [];
        this.realLayer.removeChildren();

        if (this.blurLayer.parent) this.blurLayer.parent.removeChild(this.blurLayer);
        if (this.realLayer.parent) this.realLayer.parent.removeChild(this.realLayer);

        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.piecesContainer.addChild(this.blurLayer);
        this.piecesContainer.addChild(this.realLayer);
    }

    // =========================================================================
    // BLUR SYMBOL CREATOR
    // =========================================================================
    private createBlur(): BlurSymbol {
        const types = Object.keys(this.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.tileSize);
    }

    // =========================================================================
    // BUILD BLUR LAYER
    // =========================================================================
    private buildBlurLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY - tile;
            this.blurLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0
            };

            const total = this.rows + 3;
            for (let i = 0; i < total; i++) {
                const blur = this.createBlur();
                blur.y = i * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.blurReels.push(reel);
        }

        this.ticker = new Ticker();
        this.ticker.add(() => this.updateBlurSpin());
        this.ticker.start();
    }

    // =========================================================================
    // BUILD REAL LAYER
    // =========================================================================
    private buildRealLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0
            };

            for (let r = 0; r < this.rows; r++) {
                const blur = this.createBlur();
                blur.y = r * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }
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

    private startBlurSpin() { this._blurSpinning = true; }
    private stopBlurSpin() { this._blurSpinning = false; }

    // =========================================================================
    // BACKEND APPLIED HERE
    // =========================================================================
    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        this.backendReels = reels;
        this.backendMultipliers = multipliers;
    }

    public getBackendReels(){
        return this.backendReels
    }

    public getBackendMultipliers(){
        return this.backendMultipliers
    }

    // =========================================================================
    // APPLY BACKEND RESULT TO REAL REELS
    // =========================================================================
    private applyBackendToRealLayer() {
        const tile = this.tileSize;

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];

            for (const sym of reel.symbols) sym.destroy();
            reel.symbols = [];
            reel.container.removeChildren();

            for (let r = 0; r < this.rows; r++) {
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];
                const name = this.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier: mult });
                sym.y = r * tile;

                reel.symbols.push(sym);
                reel.container.addChild(sym);
            }
        }
    }

    public animateWinningSymbols(wins: { row: number; column: number }[]) {
        for (const pos of wins) {
            const { row, column } = pos;

            const reel = this.realReels[column];
            if (!reel) continue;

            const symbol = reel.symbols[row] as SlotSymbol;
            if (!symbol) continue;

            symbol.animatePlay(true);
        }
    }



    public async startSpin(): Promise<void> {
        const maskH = this.rows * this.tileSize;

        this.destroyAllLayers();

        this.buildBlurLayer();
        this.buildRealLayer();

        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        await Promise.all([
            gsap.to(this.realLayer, { y: maskH, duration: 0.35, ease: "power0.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.35, ease: "power0.out" }),
        ]);

        this.startBlurSpin();
    }

    public async finishSpin(): Promise<void> {
        this.stopBlurSpin();
        this.applyBackendToRealLayer();

        const maskH = this.rows * this.tileSize;

        await Promise.all([
            gsap.to(this.blurLayer, {
                y: maskH + this.tileSize * 3,
                duration: 0.35,
                ease: "power2.out",
            }),
            gsap.to(this.realLayer, {
                y: 0,
                duration: 0.35,
                ease: "power2.out",
            }),
        ]);

        // ⭐ play spine animation for winning pieces
        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);
    }


    public initialPieceMutliplier(symbolType: number) {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier =
            multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];

        return [11, 12].includes(symbolType) ? randomMultiplier : 0;
    }



}
