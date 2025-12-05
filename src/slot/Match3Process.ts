import { Container, Ticker } from "pixi.js";
import { BetAPI } from "../api/betApi";
import { Match3 } from "./Match3";
import { BlurSymbol } from "../ui/BlurSymbol";
import gsap from "gsap";
import { SlotSymbol } from "./SlotSymbol";

// ⭐ SlotUtility imports
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

    private _clusterAnimating = false;

    constructor(match3: Match3) {
        this.match3 = match3;

        const mask = this.match3.board.piecesMask;

        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.blurLayer.mask = mask;
        this.realLayer.mask = mask;

        (this.blurLayer as any).isReelLayer = true;
        (this.realLayer as any).isReelLayer = true;

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

        // ⭐ Stop cluster animations before next spin
        this.stopAllClusterAnimations();

        this.processing = true;

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

        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        // Slide real out, blur in
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
        } catch (err) {
            apiSuccess = false;
        }

        this.stopBlurSpin();

        if (!apiSuccess) {
            console.warn("Backend offline or timeout.");
            return;
        }

        // Apply backend to real layer
        this.applyBackendToRealLayer(result.reels);

        // Slide blur out, real in
        await Promise.all([
            gsap.to(this.blurLayer, { 
                y: maskH + (this.match3.board.tileSize * 3),
                duration: 0.35,
                ease: "power2.out"
            }),
            gsap.to(this.realLayer, { y: 0, duration: 0.35, ease: "power2.out" }),
        ]);

        this.playInfiniteClusterAnimations();
        this.logClusterResults(result.reels, result.bonusReels);
    }

    // -----------------------------------------------------
    // LOGGING LOGIC
    // -----------------------------------------------------
    private logClusterResults(grid: number[][], bonusGrid: number[][]) {
        const finalGrid = this.getFinalGridFromRealLayer();

        console.log("FINAL GRID:", finalGrid);

        const clusters = slotGetClusters(finalGrid);
        console.log("CLUSTERS FOUND:", clusters);

        const results = slotEvaluateClusterWins(finalGrid, bonusGrid);
        console.log("WIN RESULTS:", results);
    }

    // Extract number grid from realReels
    private getFinalGridFromRealLayer(): number[][] {
        const board = this.match3.board;
        const rows = board.rows;
        const cols = board.columns;

        const grid: number[][] = [];

        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) {
                const symbol = this.realReels[c].symbols[r] as SlotSymbol;
                grid[r][c] = symbol.type;
            }
        }
        return grid;
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
            col.y = -offsetY - tile;

            this.blurLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            const total = rows + 3;
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
    // APPLY BACKEND TO REAL LAYER
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

    public stopAllClusterAnimations() {
        this._clusterAnimating = false;

        // Stop ALL SlotSymbols animation loops
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

        // 1. Gather grid of SlotSymbols
        const grid: SlotSymbol[][] = [];
        for (let r = 0; r < board.rows; r++) {
            grid[r] = [];
            for (let c = 0; c < board.columns; c++) {
                const sym = this.realReels[c].symbols[r] as SlotSymbol;
                grid[r][c] = sym;
            }
        }

        // 2. Convert SlotSymbols → number grid
        const numGrid: number[][] = grid.map(row =>
            row.map(sym => sym.type)
        );

        // 3. Detect clusters using your SlotUtility
        const clusters = slotGetClusters(numGrid);
        if (!clusters || clusters.length === 0) {
            console.log("🔥 No clusters found");
            return;
        }

        console.log("🔥 Infinite cluster animations:", clusters);

        this._clusterAnimating = true;

        // 4. Animate all cluster symbols infinitely
        for (const cluster of clusters) {
            for (const pos of cluster.positions) {
                const sym = grid[pos.row][pos.column];
                if (!sym) continue;

                sym.__match3ProcessRef = this;

                // Loop forever until next spin
                sym.animatePlay(true);
            }
        }
    }

}
