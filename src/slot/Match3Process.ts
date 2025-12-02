import { Container, BlurFilter, Ticker } from 'pixi.js';
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
    blur: BlurFilter;
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

    /** ENTRY POINT FOR EVERY SPIN */
    public async start() {
        if (this.processing) return;

        this.processing = true;

        await this.spinWithAnimation();

        // Play win animations
        await this.animateClusterWins();

        // Evaluate wins after animation
        this.evaluateClusterResults();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    // -------------------------------------------------
    //  CLUSTER WIN ANIMATION
    // -------------------------------------------------
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

        for (const win of wins) {
            console.log(
                `⭐ Cluster Win → Type: ${win.type}, Count: ${win.count}, Pay: ${win.win}`
            );
        }
    }

    // -------------------------------------------------
    //  MAIN SPIN LOGIC (PIXIS-style reel spin!)
    // -------------------------------------------------
    private async spinWithAnimation() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        // 1. Fetch backend result
        const result = await BetAPI.spin("n");
        const reelsResult = result.reels;       // matrix [row][col]
        const bonusResult = result.bonusReels;  // multiplier matrix

        // 2. Build reel containers if not built yet
        if (!this.reels.length) {
            this.buildReels();
        }

        // 3. Animate reels (PIXI style)
        await this.spinReels(reelsResult, bonusResult);

        // 4. After animation, apply backend results
        this.applyBackendResults(reelsResult, bonusResult);
    }

    // -------------------------------------------------
    // BUILD REELS (run once)
    // -------------------------------------------------
    private buildReels() {
    const board = this.match3.board;
    const tileSize = board.tileSize;

    // Calculate original grid centering offsets
    const offsetX = ((board.columns - 1) * tileSize) / 2;
    const offsetY = ((board.rows - 1) * tileSize) / 2;

    this.reels = [];

    for (let c = 0; c < board.columns; c++) {

        const reelContainer = new Container();

        // 🎯 Align reel EXACTLY where your original grid column was
        // NOTE: +tileSize is required because PIXI reel formula uses -tileSize internal offset
        reelContainer.x = c * tileSize - offsetX;
        reelContainer.y = -offsetY + tileSize;

        board.piecesContainer.addChild(reelContainer);

        const reel: Reel = {
            container: reelContainer,
            symbols: [],
            position: 0,
            previousPosition: 0,
            target: 0,
            blur: new BlurFilter()
        };

        reel.blur.blurX = 0;
        reel.blur.blurY = 0;
        reelContainer.filters = [reel.blur];

        // Get symbols belonging to this column
        const colSymbols = board.pieces.filter(p => p.column === c);
        colSymbols.sort((a, b) => a.row - b.row);

        // 👉 Reposition symbols INSIDE reel
        // PIXI reel math assumes symbols start at y = -tileSize (top overflow)
        for (let i = 0; i < colSymbols.length; i++) {
            const s = colSymbols[i];

            s.x = 0;
            s.y = (i - 1) * tileSize;   // 👈 CRITICAL FIX: shift up one row

            reelContainer.addChild(s);
            reel.symbols.push(s);
        }

        this.reels.push(reel);
    }

    // Start ticker to animate reels
    this.ticker = new Ticker();
    this.ticker.add(() => this.updateReels());
    this.ticker.start();
}



    // -------------------------------------------------
    // SPIN REELS (with tweenTo style animation)
    // -------------------------------------------------
    private async spinReels(result: number[][], bonus: number[][]) {
        const spinPromises: Promise<void>[] = [];

        for (let i = 0; i < this.reels.length; i++) {
            const reel = this.reels[i];

            const extra = Math.floor(Math.random() * 3);
            const tilesPerReel = this.match3.board.rows;

            // Target spin position (same logic as PIXI example)
            reel.target = reel.position + 10 + i * 5 + extra;

            const duration = 2500 + i * 600 + extra * 600;

            spinPromises.push(
                this.tweenReelTo(reel, "position", reel.target, duration, this.easeBackout(0.5))
            );
        }

        await Promise.all(spinPromises);
    }

    // -------------------------------------------------
    // UPDATE REELS (ticker)
    // -------------------------------------------------
    private updateReels() {
        const tileSize = this.match3.board.tileSize;

        for (let r = 0; r < this.reels.length; r++) {
            const reel = this.reels[r];

            // Blur based on speed
            reel.blur.blurY = (reel.position - reel.previousPosition) * 8;
            reel.previousPosition = reel.position;

            // Move symbols based on reel.position
            const total = reel.symbols.length;

            for (let i = 0; i < total; i++) {
                const s = reel.symbols[i];
                const prevY = s.y;

                s.y = ((reel.position + i) % total) * tileSize - tileSize;

                if (s.y < 0 && prevY > tileSize) {
                    // Wraparound: change to random symbol (temporarily)
                    const typeKeys = Object.keys(this.match3.board.typesMap);
                    const randomType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
                    const name = this.match3.board.typesMap[Number(randomType)];

                    s.setup({
                        name,
                        type: Number(randomType),
                        size: tileSize,
                        multiplier: 0,
                        interactive: false
                    });
                }
            }
        }
    }

    // -------------------------------------------------
    // APPLY BACKEND RESULT (after spin stops)
    // -------------------------------------------------
    private applyBackendResults(types: number[][], bonus: number[][]) {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        for (let c = 0; c < this.reels.length; c++) {
            const reel = this.reels[c];

            // Sort by current visual y to get visible area
            const sorted = [...reel.symbols].sort((a, b) => a.y - b.y);

            for (let r = 0; r < board.rows; r++) {
                const s = sorted[r];

                const backendType = types[r][c];
                const backendMultiplier = bonus[r][c];

                const name = board.typesMap[backendType];

                // Update the symbol to backend result
                s.setup({
                    name,
                    type: backendType,
                    size: tileSize,
                    multiplier: backendMultiplier,
                    interactive: false
                });

                // Update real grid type
                board.grid[r][c] = backendType;

                // Fix row, column mapping
                s.row = r;
                s.column = c;
            }
        }
    }

    // -------------------------------------------------
    // TWEEN ENGINE (like the PIXI example)
    // -------------------------------------------------
    private tweenReelTo(
        reel: Reel,
        property: keyof Reel,
        target: number,
        time: number,
        easing: (t: number) => number
    ): Promise<void> {
        const start = Date.now();
        const propertyBegin = reel[property] as number;

        return new Promise(resolve => {
            const tick = () => {
                const now = Date.now();
                const t = Math.min(1, (now - start) / time);

                (reel as any)[property] = propertyBegin + (target - propertyBegin) * easing(t);

                if (t === 1) {
                    (reel as any)[property] = target;
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
}
