import { Container, Ticker } from "pixi.js";
import { BetAPI } from "../api/betApi";
import { Match3 } from "./Match3";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";
import gsap from "gsap";
import { slotGetClusters, slotEvaluateClusterWins, RoundResult } from "./SlotUtility";

import { navigation } from "../utils/navigation";
import { SpinRoundBanner } from "../ui/SpinRoundBanner";
import { AsyncQueue } from "../utils/asyncUtils";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
}

export class Match3Process {
    protected match3: Match3;
    protected processing = false;
    protected round = 0;
    protected hasRoundWin = false;
    protected isBannerDraw = false;
    protected bannerTimer: any = null;

    private queue: AsyncQueue;

    private blurLayer: Container;
    private realLayer: Container;

    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];

    private ticker?: Ticker;
    private _blurSpinning = false;
    private _blurSpinSpeed = 0.55;

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();

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
    protected destroyAllLayers() {
        // Stop ticker
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        // Kill all animations
        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        // Destroy blur reels content
        for (const reel of this.blurReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.blurReels = [];
        this.blurLayer.removeChildren();

        // Destroy real reels content
        for (const reel of this.realReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.realReels = [];
        this.realLayer.removeChildren();

        // ---------------------------------------------------------
        // ⭐ CRITICAL FIX: Remove layer containers entirely
        // ---------------------------------------------------------
        if (this.blurLayer.parent) this.blurLayer.parent.removeChild(this.blurLayer);
        if (this.realLayer.parent) this.realLayer.parent.removeChild(this.realLayer);

        // Recreate fresh layers for next spin
        const mask = this.match3.board.piecesMask;
        this.blurLayer = new Container();
        this.realLayer = new Container();

        this.blurLayer.mask = mask;
        this.realLayer.mask = mask;

        // Re-attach them empty
        this.match3.board.piecesContainer.addChild(this.blurLayer);
        this.match3.board.piecesContainer.addChild(this.realLayer);
    }

    // -----------------------------------------------------
    // ENTRY POINT
    // -----------------------------------------------------
    public async start() {
        if (this.bannerTimer) {
            clearTimeout(this.bannerTimer);
            this.bannerTimer = null;
        }
        SpinRoundBanner.forceDismiss();

        if (this.processing) {
            this.forceFinishSpin();
            return;
        }

        this.processing = true;

        this.stopAllClusterAnimations();
        this.match3.board.removeInitialPiecesOnly();

        await this.spinSequence();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    // -----------------------------------------------------
    // MAIN SEQUENCE
    // -----------------------------------------------------
    protected async spinSequence() {
        this.startSpinLog();
        const maskH = this.match3.board.rows * this.match3.board.tileSize;

        this.destroyAllLayers();

        // Build new layers
        this.buildBlurLayer();
        this.buildRealLayer();

        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        await Promise.all([
            gsap.to(this.realLayer, { y: maskH, duration: 0.35, ease: "power0.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.35, ease: "power0.out" }),
        ]);

        this.startBlurSpin();

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

        this.applyBackendToRealLayer(result.reels, result.bonusReels);

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

        const roundResult = slotEvaluateClusterWins(this.getFinalGridFromRealLayer(), result.bonusReels);
        this.setHasRoundWin(roundResult);
        this.setHasBannerDrawn(roundResult);
        this.DrawSpinRoundBanner(roundResult);
    }

    // -----------------------------------------------------
    // LOGS
    // -----------------------------------------------------
    protected logClusterResults(grid: number[][], bonusGrid: number[][]) {
        const finalGrid = this.getFinalGridFromRealLayer();

        console.log("FINAL GRID:", finalGrid);
        const clusters = slotGetClusters(finalGrid);
        console.log("CLUSTERS FOUND:", clusters);

        const results: RoundResult = slotEvaluateClusterWins(finalGrid, bonusGrid);
        console.log("WIN RESULTS:", results);
    }

    protected getFinalGridFromRealLayer() {
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

    // BLUR SYMBOL
    protected createBlur() {
        const types = Object.keys(this.match3.board.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.match3.board.tileSize);
    }

    // BUILD BLUR LAYER
    protected buildBlurLayer() {
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

    // BUILD REAL LAYER
    protected buildRealLayer() {
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

            // TEMP BLURS
            for (let r = 0; r < board.rows; r++) {
                const blur = this.createBlur();
                blur.y = r * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }
    }

    // APPLY BACKEND
    protected applyBackendToRealLayer(grid: number[][], bonusGrid: number[][]) {
        const board = this.match3.board;
        const tile = board.tileSize;

        for (let c = 0; c < board.columns; c++) {
            const reel = this.realReels[c];

            for (const sym of reel.symbols) sym.destroy();
            reel.symbols = [];
            reel.container.removeChildren();

            for (let r = 0; r < board.rows; r++) {
                const type = grid[r][c];
                const multiplier = bonusGrid[r][c];
                const name = board.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier });
                sym.y = r * tile;

                // sym.showBlurSprite();

                reel.symbols.push(sym);
                reel.container.addChild(sym);
            }
        }
    }

    protected startBlurSpin() { this._blurSpinning = true; }
    protected stopBlurSpin() { this._blurSpinning = false; }

    protected updateBlurSpin() {
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
        for (const col of this.realReels) {
            for (const sym of col.symbols) {
                if (sym instanceof SlotSymbol) {
                    sym._isLooping = false;
                    sym.stopAnimationImmediately();
                }
            }
        }
    }

    protected async playInfiniteClusterAnimations() {
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

    protected async DrawSpinRoundBanner(roundResult: RoundResult) {
        const totalFinalWin = roundResult.reduce((sum, r) => sum + r.finalWin, 0);

        if (totalFinalWin < 50) return;

        if (this.bannerTimer) {
            clearTimeout(this.bannerTimer);
            this.bannerTimer = null;
        }

        this.bannerTimer = setTimeout(() => {
            if (this.processing) return;
            navigation.presentPopup(SpinRoundBanner, { win: totalFinalWin });
            this.bannerTimer = null;
        }, 2000);
    }

    public startSpinLog() {
        console.log("Spin Session from the Match3Process");
    }

    public setHasRoundWin(roundResult: RoundResult) {
        const totalFinalWin = roundResult.reduce((sum, r) => sum + r.finalWin, 0);
        this.hasRoundWin = totalFinalWin > 0;
    }

    public setHasBannerDrawn(roundResult: RoundResult) {
        const totalFinalWin = roundResult.reduce((sum, r) => sum + r.finalWin, 0);
        this.isBannerDraw = totalFinalWin >= 50;
    }

    private forceFinishSpin() {
        console.log("Force finishing spin...");

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        this._blurSpinning = false;

        if (this.ticker) {
            this.ticker.stop();
        }

        const maskH = this.match3.board.rows * this.match3.board.tileSize;
        this.blurLayer.y = maskH + this.match3.board.tileSize * 3;
        this.realLayer.y = 0;

        if (this.bannerTimer) {
            clearTimeout(this.bannerTimer);
            this.bannerTimer = null;
        }
        SpinRoundBanner.forceDismiss();

        this.stopAllClusterAnimations();

        console.log("Spin forced to finish instantly.");
    }

    public destroy() {
        // Stop ticker
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        // Kill GSAP
        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        // Remove & destroy layers
        if (this.blurLayer.parent) {
            this.blurLayer.parent.removeChild(this.blurLayer);
        }
        if (this.realLayer.parent) {
            this.realLayer.parent.removeChild(this.realLayer);
        }

        this.blurLayer.destroy({ children: true });
        this.realLayer.destroy({ children: true });

        // Clear reel references
        this.blurReels = [];
        this.realReels = [];
    }

}
