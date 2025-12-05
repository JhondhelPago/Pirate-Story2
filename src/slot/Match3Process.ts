import { Container, Ticker } from "pixi.js";
import { BetAPI } from "../api/betApi";
import { Match3 } from "./Match3";
import { BlurSymbol } from "../ui/BlurSymbol";
import gsap from "gsap";
import { SlotSymbol } from "./SlotSymbol";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    // Two layers
    private blurLayer: Container;
    private realLayer: Container;

    // Reels for blur + real layers
    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];

    private ticker?: Ticker;

    constructor(match3: Match3) {
        this.match3 = match3;

        const mask = this.match3.board.piecesMask;

        // 🌟 Create two vertically stacked layers
        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.blurLayer.mask = mask;
        this.realLayer.mask = mask;

        // Mark layers so Match3Board will NOT delete them
        (this.blurLayer as any).isReelLayer = true;
        (this.realLayer as any).isReelLayer = true;

        // Add both layers into board container
        this.match3.board.piecesContainer.addChild(this.blurLayer);
        this.match3.board.piecesContainer.addChild(this.realLayer);
    }

    public isProcessing() {
        return this.processing;
    }

    public pause() {}
    public resume() {}
    public reset() {
        this.processing = false;
    }

    // -----------------------------------------------------
    // ENTRY POINT
    // -----------------------------------------------------
    public async start() {
        if (this.processing) return;

        this.processing = true;

        // ⭐ Remove initial 5x5 SlotSymbols cleanly using the NEW METHOD
        this.match3.board.removeInitialPiecesOnly();

        await this.spinSequence();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    // -----------------------------------------------------
    // MAIN SPIN SEQUENCE
    // -----------------------------------------------------
    private async spinSequence() {
        const maskH = this.match3.board.rows * this.match3.board.tileSize;

        if (!this.blurReels.length) this.buildBlurLayer();
        if (!this.realReels.length) this.buildRealLayer();

        // Move layers to initial slide positions
        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        // Slide realLayer OUT, blurLayer IN
        await Promise.all([
            gsap.to(this.realLayer, { y: maskH, duration: 0.35, ease: "power2.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.35, ease: "power2.out" }),
        ]);

        // Start blur spin
        this.startBlurSpin();

        // Wait backend
        let result: any;
        let apiSuccess = true;
        try {
            result = await Promise.race([
                BetAPI.spin("n"),
                new Promise((_, reject) => setTimeout(() => reject("timeout"), 5000)),
            ]);
        } catch (err) {
            apiSuccess = false;
        }

        this.stopBlurSpin();

        if (!apiSuccess) {
            console.warn("Backend offline or timeout.");
            return;
        }

        // Update realLayer with backend reels
        this.applyBackendToRealLayer(result.reels);

        // Slide blurLayer OUT, realLayer IN
        await Promise.all([
            gsap.to(this.blurLayer, { y: maskH, duration: 0.35, ease: "power2.out" }),
            gsap.to(this.realLayer, { y: 0, duration: 0.35, ease: "power2.out" }),
        ]);
    }

    // -----------------------------------------------------
    // CREATE RANDOM BLUR SYMBOL
    // -----------------------------------------------------
    private createBlur(): BlurSymbol {
        const types = Object.keys(this.match3.board.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.match3.board.tileSize);
    }

    // -----------------------------------------------------
    // BUILD BLUR LAYER (spinning)
    // -----------------------------------------------------
    private buildBlurLayer() {
        const board = this.match3.board;
        const tile = board.tileSize;
        const cols = board.columns;
        const rows = board.rows;

        const offsetX = ((cols - 1) * tile) / 2;
        const offsetY = ((rows - 1) * tile) / 2;

        for (let c = 0; c < cols; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;

            this.blurLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            const total = rows + 2;
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

    // -----------------------------------------------------
    // BUILD REAL LAYER (static)
    // -----------------------------------------------------
    private buildRealLayer() {
        const board = this.match3.board;
        const tile = board.tileSize;
        const cols = board.columns;
        const rows = board.rows;

        const offsetX = ((cols - 1) * tile) / 2;
        const offsetY = ((rows - 1) * tile) / 2;

        for (let c = 0; c < cols; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;

            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            for (let r = 0; r < rows; r++) {
                const blur = this.createBlur();
                blur.y = r * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }
    }

    // -----------------------------------------------------
    // APPLY BACKEND GRID TO REAL LAYER (SlotSymbol)
    // -----------------------------------------------------
    private applyBackendToRealLayer(grid: number[][]) {
        const board = this.match3.board;
        const tile = board.tileSize;

        for (let c = 0; c < this.realReels.length; c++) {
            const reel = this.realReels[c];

            for (const s of reel.symbols) s.destroy();
            reel.symbols = [];
            reel.container.removeChildren();

            for (let r = 0; r < board.rows; r++) {
                const type = grid[r][c];
                const name = board.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier: 0 });
                sym.y = r * tile;

                reel.symbols.push(sym);
                reel.container.addChild(sym);
            }
        }
    }

    // -----------------------------------------------------
    // BLUR SPIN LOOP
    // -----------------------------------------------------
    private _blurSpinSpeed = 0.55;
    private _blurSpinning = false;

    private startBlurSpin() {
        this._blurSpinSpeed = 0.55;
        this._blurSpinning = true;
    }

    private stopBlurSpin() {
        this._blurSpinning = false;
    }

    private updateBlurSpin() {
        if (!this._blurSpinning) return;

        const tile = this.match3.board.tileSize;

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
}
