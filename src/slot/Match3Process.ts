import { Container, Ticker } from 'pixi.js';
import { BetAPI } from '../api/betApi';
import { Match3 } from './Match3';
import { SlotSymbol } from './SlotSymbol';
import {
    slotGetClusters,
    slotEvaluateClusterWins
} from './SlotUtility';

interface Reel {
    container: Container;
    symbols: SlotSymbol[];
    position: number;
    target: number;
    previousPosition: number;
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    private reels: Reel[] = [];
    private ticker?: Ticker;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public isProcessing() {
        return this.processing;
    }
    public pause() {}
    public resume() {}
    public reset() {
        this.processing = false;
    }

    // ENTRY POINT
    public async start() {
        if (this.processing) return;
        this.processing = true;

        await this.spinWithAnimation();
        await this.animateClusterWins();
        this.evaluateClusterResults();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    // -----------------------------------------------------
    // CLUSTER WIN ANIMATION
    // -----------------------------------------------------
    private async animateClusterWins() {
        const grid = this.match3.board.grid;
        const clusters = slotGetClusters(grid);
        if (!clusters.length) return;

        const animations: Promise<void>[] = [];

        for (const cluster of clusters) {
            for (const pos of cluster.positions) {
                const piece = this.match3.board.getPieceByPosition(pos);
                if (!piece) continue;
                animations.push(piece.animatePlay());
            }
        }
        await Promise.all(animations);
    }

    private evaluateClusterResults() {
        const grid = this.match3.board.grid;
        const wins = slotEvaluateClusterWins(grid);
        console.log("💰 CLUSTER WINS:", wins);
    }

    // -----------------------------------------------------
    // MAIN SPIN LOGIC
    // -----------------------------------------------------
    private async spinWithAnimation() {
        const result = await BetAPI.spin("n");

        const reelsResult = result.reels;
        const bonusResult = result.bonusReels;

        if (!this.reels.length) {
            this.buildReels();
        }

        // ⭐ RESET INTERNAL POSITIONS FIRST
        this.resetReelsState();

        // ⭐ Remove previous backend symbols
        this.clearBackendSymbols();

        // ⭐ Add NEW backend symbols
        this.appendBackendReels(reelsResult, bonusResult);

        await this.spinReels();

        this.setFinalGridState(reelsResult);

        console.log("🎉 Spin complete with natural landing.");
    }

    // Reset reel positions to avoid stuck reels
    private resetReelsState() {
        for (const reel of this.reels) {
            reel.position = 0;
            reel.previousPosition = 0;
            reel.target = 0;
        }
    }

    // -----------------------------------------------------
    // BUILD REELS ONLY ONCE
    // -----------------------------------------------------
    private buildReels() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        const offsetX = ((board.columns - 1) * tileSize) / 2;
        const offsetY = ((board.rows - 1) * tileSize) / 2;

        for (let c = 0; c < board.columns; c++) {
            const reelContainer = new Container();
            reelContainer.x = c * tileSize - offsetX;
            reelContainer.y = -offsetY + tileSize;

            reelContainer.mask = board.piecesMask;

            board.piecesContainer.addChild(reelContainer);

            const reel: Reel = {
                container: reelContainer,
                symbols: [],
                position: 0,
                previousPosition: 0,
                target: 0
            };

            const colSymbols = board.pieces.filter(p => p.column === c);
            colSymbols.sort((a, b) => a.row - b.row);

            for (let i = 0; i < colSymbols.length; i++) {
                const s = colSymbols[i];
                s.x = 0;
                s.y = (i - 1) * tileSize;
                reelContainer.addChild(s);
                reel.symbols.push(s);
            }

            this.reels.push(reel);
        }

        this.ticker = new Ticker();
        this.ticker.add(() => this.updateReels());
        this.ticker.start();
    }

    // -----------------------------------------------------
    // APPEND BACKEND SYMBOLS
    // -----------------------------------------------------
    private appendBackendReels(types: number[][], bonus: number[][]) {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        for (let c = 0; c < this.reels.length; c++) {
            const backendColumn: SlotSymbol[] = [];

            for (let r = 0; r < board.rows; r++) {
                const backendType = types[r][c];
                const backendMult = bonus[r][c];
                const name = board.typesMap[backendType];

                const symbol = new SlotSymbol();
                symbol.setup({
                    name,
                    type: backendType,
                    size: tileSize,
                    multiplier: backendMult,
                });

                symbol.x = 0;
                symbol.y = (this.reels[c].symbols.length + backendColumn.length - 1) * tileSize;

                backendColumn.push(symbol);
            }

            for (let s of backendColumn) {
                this.reels[c].container.addChild(s);
                this.reels[c].symbols.push(s);
            }
        }
    }

    // -----------------------------------------------------
    // SPIN ANIMATION (NATURAL LANDING)
    // -----------------------------------------------------
    private async spinReels() {
        const board = this.match3.board;
        const visible = board.rows;

        const spinPromises: Promise<void>[] = [];

        for (let i = 0; i < this.reels.length; i++) {
            const reel = this.reels[i];

            const extra = Math.floor(Math.random() * 3);
            const spinCycles = 10 + i * 5 + extra;

            const totalSymbols = reel.symbols.length;
            const backendStartIndex = totalSymbols - visible;

            const targetPosition =
                spinCycles * totalSymbols + backendStartIndex;

            reel.target = targetPosition;

            const duration = 2500 + i * 600 + extra * 600;

            spinPromises.push(
                this.tweenReelTo(
                    reel,
                    "position",
                    targetPosition,
                    duration,
                    this.easeBackout(0.5)
                )
            );
        }

        await Promise.all(spinPromises);
    }

    // -----------------------------------------------------
    // UPDATE REELS DURING SPIN
    // -----------------------------------------------------
    private updateReels() {
        const tileSize = this.match3.board.tileSize;

        for (let r = 0; r < this.reels.length; r++) {
            const reel = this.reels[r];

            reel.previousPosition = reel.position;

            const total = reel.symbols.length;

            for (let i = 0; i < total; i++) {
                const s = reel.symbols[i];
                s.y = ((reel.position + i) % total) * tileSize - tileSize;
            }
        }
    }

    // -----------------------------------------------------
    // UPDATE LOGICAL GRID
    // -----------------------------------------------------
    private setFinalGridState(types: number[][]) {
        const board = this.match3.board;

        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.columns; c++) {
                board.grid[r][c] = types[r][c];
            }
        }

        console.log("🧩 Logical grid updated.");
    }

    // -----------------------------------------------------
    // NATURAL LANDING TWEEN
    // -----------------------------------------------------
    private tweenReelTo(
        reel: Reel,
        property: keyof Reel,
        target: number,
        time: number,
        easing: (t: number) => number
    ): Promise<void> {
        const start = Date.now();
        const begin = reel[property] as number;

        return new Promise(resolve => {
            const tick = () => {
                const now = Date.now();
                const t = Math.min(1, (now - start) / time);

                (reel as any)[property] =
                    begin + (target - begin) * easing(t);

                if (t === 1) {
                    resolve();
                    return;
                }

                requestAnimationFrame(tick);
            };
            tick();
        });
    }

    private easeBackout(amount: number) {
        return (t: number) =>
            --t * t * ((amount + 1) * t + amount) + 1;
    }

    public async stop() {
        this.processing = false;
    }

    /** Remove old backend symbols before adding new ones */
    private clearBackendSymbols() {
        const board = this.match3.board;
        const visible = board.rows;

        for (const reel of this.reels) {
            while (reel.symbols.length > visible) {
                const s = reel.symbols.pop()!;
                s.destroy();
            }
        }
    }
}
