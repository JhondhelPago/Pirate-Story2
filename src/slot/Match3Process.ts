import { Container, Ticker } from "pixi.js";
import { BetAPI } from "../api/betApi";
import { Match3 } from "./Match3";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";
import gsap from "gsap";
import { slotGetClusters, slotEvaluateClusterWins } from "./SlotUtility";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    private blurLayer: Container;
    private realLayer: Container;

    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];

    private ticker?: Ticker;
    private _blurSpinning = false;
    private _blurSpinSpeed = 0.55;

    private _clusterAnimating = false;

    constructor(match3: Match3) {
        this.match3 = match3;

        const mask = this.match3.board.piecesMask;

        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.blurLayer.mask = mask;
        this.realLayer.mask = mask;

        this.match3.board.piecesContainer.addChild(this.blurLayer);
        this.match3.board.piecesContainer.addChild(this.realLayer);
    }

    public isProcessing() { return this.processing; }
    public pause() {}
    public resume() {}
    public reset() { this.processing = false; }

    // -----------------------------------------------------
    // DESTROY ENTIRE SPIN STATE (BOTH LAYERS)
    // -----------------------------------------------------
    private destroyAllLayers() {
        // Stop tickers
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        // Kill GSAP animations
        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        // Destroy blur layer completely
        for (const reel of this.blurReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.blurReels = [];
        this.blurLayer.removeChildren();

        // Destroy real layer completely
        for (const reel of this.realReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.realReels = [];
        this.realLayer.removeChildren();

        // Stop cluster animations safely
        this._clusterAnimating = false;
    }

    // -----------------------------------------------------
    // ENTRY POINT
    // -----------------------------------------------------
    public async start() {
        if (this.processing) return;

        this.stopAllClusterAnimations();
        this.processing = true;

        this.match3.board.removeInitialPiecesOnly();
        await this.spinSequence();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    // -----------------------------------------------------
    // MAIN SEQUENCE
    // -----------------------------------------------------
    private async spinSequence() {
        const maskH = this.match3.board.rows * this.match3.board.tileSize;

        // ❗ FULL RESET OF ALL MEMORY
        this.destroyAllLayers();

        // Fresh layers
        this.buildBlurLayer();
        this.buildRealLayer();

        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        // Entrance transition
        await Promise.all([
            gsap.to(this.realLayer, { y: maskH, duration: 0.35, ease: "power2.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.35, ease: "power2.out" }),
        ]);

        this.startBlurSpin();

        // Fetch backend
        let result: any;
        let apiSuccess = true;

        try {
            result = await Promise.race([
                BetAPI.spin("n"),
                new Promise((_, reject) => setTimeout(() => reject("timeout"), 5000)),
            ]);
        } catch (e) {
            apiSuccess = false;
        }

        this.stopBlurSpin();

        if (!apiSuccess) {
            console.warn("Backend offline or timeout.");
            return;
        }

        // Apply backend
        this.applyBackendToRealLayer(result.reels);

        // Slide back real layer
        await Promise.all([
            gsap.to(this.blurLayer, {
                y: maskH + this.match3.board.tileSize * 3,
                duration: 0.35,
                ease: "power2.out"
            }),
            gsap.to(this.realLayer, { y: 0, duration: 0.35, ease: "power2.out" }),
        ]);

        this.playInfiniteClusterAnimations();
        this.logClusterResults(result.reels, result.bonusReels);
    }

    // -----------------------------------------------------
    // LOGS
    // -----------------------------------------------------
    private logClusterResults(grid: number[][], bonusGrid: number[][]) {
        const finalGrid = this.getFinalGridFromRealLayer();

        console.log("FINAL GRID:", finalGrid);

        const clusters = slotGetClusters(finalGrid);
        console.log("CLUSTERS FOUND:", clusters);

        const results = slotEvaluateClusterWins(finalGrid, bonusGrid);
        console.log("WIN RESULTS:", results);
    }

    private getFinalGridFromRealLayer() {
        const board = this.match3.board;
        const grid: number[][] = [];

        for (let r = 0; r < board.rows; r++) {
            grid[r] = [];
            for (let c = 0; c < board.columns; c++) {
                grid[r][c] = (this.realReels[c].symbols[r] as SlotSymbol).type;
            }
        }
        return grid;
    }

    // -----------------------------------------------------
    // BLUR SYMBOL
    // -----------------------------------------------------
    private createBlur() {
        const types = Object.keys(this.match3.board.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.match3.board.tileSize);
    }

    // -----------------------------------------------------
    // BUILD BLUR LAYER
    // -----------------------------------------------------
    private buildBlurLayer() {
        const board = this.match3.board;
        const tile = board.tileSize;

        const offsetX = ((board.columns - 1) * tile) / 2;
        const offsetY = ((board.rows - 1) * tile) / 2;

        for (let c = 0; c < board.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY - tile;
            this.blurLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            const total = board.rows + 3;
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
    // BUILD REAL LAYER
    // -----------------------------------------------------
    private buildRealLayer() {
        const board = this.match3.board;
        const tile = board.tileSize;

        const offsetX = ((board.columns - 1) * tile) / 2;
        const offsetY = ((board.rows - 1) * tile) / 2;

        for (let c = 0; c < board.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            // Fill with temporary blur (will be replaced)
            for (let r = 0; r < board.rows; r++) {
                const blur = this.createBlur();
                blur.y = r * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }
    }

    // -----------------------------------------------------
    // APPLY BACKEND — ALWAYS CREATE NEW SYMBOLS
    // -----------------------------------------------------
    private applyBackendToRealLayer(grid: number[][]) {
        const board = this.match3.board;
        const tile = board.tileSize;

        for (let c = 0; c < board.columns; c++) {
            const reel = this.realReels[c];

            // Destroy old
            for (const sym of reel.symbols) sym.destroy();
            reel.symbols = [];
            reel.container.removeChildren();

            // Create new SlotSymbols
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
    // BLUR SPIN
    // -----------------------------------------------------
    private startBlurSpin() { this._blurSpinning = true; }
    private stopBlurSpin() { this._blurSpinning = false; }

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

    // -----------------------------------------------------
    // CLUSTER ANIMATIONS
    // -----------------------------------------------------
    public stopAllClusterAnimations() {
        this._clusterAnimating = false;

        for (const col of this.realReels) {
            for (const sym of col.symbols) {
                if (sym instanceof SlotSymbol) {
                    sym._isLooping = false;
                    sym.stopAnimationImmediately();
                }
            }
        }
    }

    private async playInfiniteClusterAnimations() {
        const board = this.match3.board;

        const grid: SlotSymbol[][] = [];
        for (let r = 0; r < board.rows; r++) {
            grid[r] = [];
            for (let c = 0; c < board.columns; c++) {
                grid[r][c] = this.realReels[c].symbols[r] as SlotSymbol;
            }
        }

        const numGrid = grid.map(row => row.map(sym => sym.type));
        const clusters = slotGetClusters(numGrid);
        if (!clusters.length) return;

        this._clusterAnimating = true;

        const uniqueSymbols = new Set<SlotSymbol>();
        for (const cluster of clusters) {
            for (const pos of cluster.positions) {
                uniqueSymbols.add(grid[pos.row][pos.column]);
            }
        }

        for (const sym of uniqueSymbols) {
            sym._isLooping = false;
            sym.animatePlay(true);
        }
    }
}
