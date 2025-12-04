import { Container, Ticker } from 'pixi.js';
import { BetAPI } from '../api/betApi';
import { Match3 } from './Match3';
import { SlotSymbol } from './SlotSymbol';
import {
    slotGetClusters,
    slotEvaluateClusterWins
} from './SlotUtility';
import gsap from 'gsap';

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
    private clusterAnimating = false;

    // ⭐ Internal temp spin helper vars
    private _isTempSpinning: boolean = false;
    private _tempSpinSpeed: number = 0;

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

    // -----------------------------------------------------
    // ENTRY POINT
    // -----------------------------------------------------
    public async start() {
        if (this.processing) return;

        this.processing = true;

        this.stopAllSymbolAnimations();

        await this.spinWithAnimation();

        // Update the landing pieces before cluster animation
        this.updateBoardPiecesFromReels();

        // ⭐ Animate clusters dynamically (NEW)
        await this.animateAllWinCluster();

        this.evaluateClusterResults();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    private evaluateClusterResults() {
        const grid = this.match3.board.grid;
        const bonusGrid = this.match3.board.multiplierGrid;
        const wins = slotEvaluateClusterWins(grid, bonusGrid);
        console.log("💰 CLUSTER WINS:", wins);
        return wins;
    }

    private async animateAllWinCluster() {
        const board = this.match3.board;
        const bonusGrid = board.multiplierGrid;
        const tileSize = board.tileSize;

        const visibleTop = tileSize * 1;
        const visibleBottom = tileSize * (board.rows + 1);

        // Cancel any previous animations
        this.clusterAnimating = false;

        // Evaluate cluster wins ONCE
        const wins = slotEvaluateClusterWins(board.grid, bonusGrid);

        // Build target set
        const targetSet = new Set<string>();
        for (const w of wins) {
            for (const p of w.positions) {
                targetSet.add(`${p.row},${p.column}`);
            }
        }

        // ❗ If NO wins → exit immediately, no flash, no animation loop
        if (targetSet.size === 0) {
            this.stopAllSymbolAnimations();
            return;
        }

        // Now we know animation is needed
        this.clusterAnimating = true;

        const animateLoop = () => {
            if (!this.clusterAnimating) return;

            for (let c = 0; c < this.reels.length; c++) {
                const reel = this.reels[c];

                for (let i = 0; i < reel.symbols.length; i++) {
                    const symbol = reel.symbols[i];

                    if (symbol.y < visibleTop || symbol.y >= visibleBottom) continue;

                    const rowIndex = Math.floor(symbol.y / tileSize) - 1;

                    if (targetSet.has(`${rowIndex},${c}`)) {
                        symbol.animatePlay(true);
                    }
                }
            }

            setTimeout(animateLoop, 800);
        };

        animateLoop();
    }


    private stopAllSymbolAnimations() {
        this.clusterAnimating = false;

        for (let c = 0; c < this.reels.length; c++) {
            const reel = this.reels[c];

            for (let symbol of reel.symbols) {
                if (!symbol) continue;

                symbol._isLooping = false;
                symbol.stopAnimationImmediately();
            }
        }
    }

    // -----------------------------------------------------
    // ⭐ NEW: TEMPORARY SPIN - START IMMEDIATELY
    // -----------------------------------------------------
    private startImmediateSpin() {
        if (!this.ticker) return;

        this._tempSpinSpeed = 0.55; // adjustable
        this._isTempSpinning = true;

        const tick = () => {
            if (!this._isTempSpinning) return;

            for (let r = 0; r < this.reels.length; r++) {
                const reel = this.reels[r];
                reel.position += this._tempSpinSpeed;
            }

            requestAnimationFrame(tick);
        };
        tick();
    }

    // -----------------------------------------------------
    // ⭐ NEW: STOP TEMP SPIN SMOOTHLY
    // -----------------------------------------------------
    private stopImmediateSpin() {
        if (!this._isTempSpinning) return;

        this._isTempSpinning = false;

        gsap.to(this, {
            _tempSpinSpeed: 0,
            duration: 0.25,
            ease: "power2.out"
        });
    }

    // -----------------------------------------------------
    // ⭐ Fallback stopping when API is offline or timeout
    // -----------------------------------------------------
    private async forceStopReelsFallback() {
        // Stop temp spin immediately
        this._isTempSpinning = false;

        return new Promise(resolve => {
            gsap.to(this, {
                _tempSpinSpeed: 0,
                duration: 0.35,
                ease: "power2.out",
                onComplete: () => {
                    console.log("🛑 Reels stopped safely (fallback due to offline API).");
                    resolve(null);
                }
            });
        });
    }


    // -----------------------------------------------------
    // SPIN (TEMP SPIN → BACKEND → FINAL SPIN)
    // -----------------------------------------------------
    private async spinWithAnimation() {

        this.startImmediateSpin();

        // ------------------------------------------------------
        // ⭐ SAFE API CALL WITH TIMEOUT
        // ------------------------------------------------------
        let result: any; // <-- allow TS to treat result as an object later
        let apiSuccess = true;

        try {
            result = await Promise.race([
                BetAPI.spin("n"),
                new Promise((_, reject) => setTimeout(() => reject("timeout"), 5000))
            ]);
        } catch (err) {
            console.warn("⚠️ Spin API offline or timeout:", err);
            apiSuccess = false;
        }

        // ⭐ Always stop temp spin
        this.stopImmediateSpin();

        // ------------------------------------------------------
        // ⭐ OFFLINE OR FAILURE → SAFE EXIT
        // ------------------------------------------------------
        if (!apiSuccess) {

            await this.forceStopReelsFallback();

            this.processing = false;
            console.warn("Spin aborted safely due to network error.");

            return;
        }

        // ------------------------------------------------------
        // ⭐ API SUCCESS — result is guaranteed valid now
        // ------------------------------------------------------
        const reelsResult = result.reels;
        const bonusResult = result.bonusReels;

        if (!this.reels.length) {
            this.buildReels();
        }

        this.resetReelsState();

        this.refreshDummySymbols();
        this.clearBackendSymbols();
        this.appendBackendReels(reelsResult, bonusResult);

        // ⭐ 3. FINAL LANDING SPIN
        await this.spinReels();

        this.setFinalGridState(reelsResult, bonusResult);

        console.log("🎉 Spin complete with natural landing.");
    }



    private resetReelsState() {
        for (const reel of this.reels) {
            reel.position = 0;
            reel.previousPosition = 0;
            reel.target = 0;
        }
    }

    private createRandomDummySymbol(column: number): SlotSymbol {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        const typeKeys = Object.keys(board.typesMap).map(Number);
        const randType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
        const name = board.typesMap[randType];

        const s = new SlotSymbol();
        s.setup({
            name,
            type: randType,
            size: tileSize,
            multiplier: 0,
        });

        s.alpha = 1;
        s.x = 0;
        return s;
    }

    // -----------------------------------------------------
    // ⭐ FIX: REGENERATE DUMMY ROWS EVERY SPIN
    // -----------------------------------------------------
    private refreshDummySymbols() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        for (let c = 0; c < this.reels.length; c++) {
            const reel = this.reels[c];

            const oldTop = reel.symbols[0];
            const oldBottom = reel.symbols[reel.symbols.length - 1];

            reel.container.removeChild(oldTop);
            reel.container.removeChild(oldBottom);
            oldTop.destroy();
            oldBottom.destroy();

            const newTop = this.createRandomDummySymbol(c);
            newTop.y = -tileSize;

            const newBottom = this.createRandomDummySymbol(c);
            newBottom.y = (this.match3.board.rows) * tileSize;

            reel.symbols[0] = newTop;
            reel.symbols[reel.symbols.length - 1] = newBottom;

            reel.container.addChild(newTop);
            reel.container.addChild(newBottom);
        }
    }

    // -----------------------------------------------------
    // BUILD REELS
    // -----------------------------------------------------
    private buildReels() {
        const board = this.match3.board;
               const tileSize = board.tileSize;

        const offsetX = ((board.columns - 1) * tileSize) / 2;
        const offsetY = ((board.rows - 1) * tileSize) / 2;

        for (let c = 0; c < board.columns; c++) {
            const reelContainer = new Container();
            reelContainer.x = c * tileSize - offsetX;
            reelContainer.y = -offsetY + (-1 * tileSize);
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

            const topDummy = this.createRandomDummySymbol(c);
            topDummy.y = -tileSize;
            reelContainer.addChild(topDummy);
            reel.symbols.push(topDummy);

            for (let i = 0; i < colSymbols.length; i++) {
                const s = colSymbols[i];
                s.x = 0;
                s.y = i * tileSize;
                reelContainer.addChild(s);
                reel.symbols.push(s);
            }

            const bottomDummy = this.createRandomDummySymbol(c);
            bottomDummy.y = colSymbols.length * tileSize;
            reelContainer.addChild(bottomDummy);
            reel.symbols.push(bottomDummy);

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
            const reel = this.reels[c];
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

                symbol.alpha = 1;
                symbol.x = 0;
                symbol.y = reel.symbols.length * tileSize;

                backendColumn.push(symbol);
            }

            for (let s of backendColumn) {
                reel.container.addChild(s);
                reel.symbols.push(s);
            }
        }
    }

    // -----------------------------------------------------
    // SPIN TWEENING
    // -----------------------------------------------------
    private async spinReels() {
        const board = this.match3.board;
        const visible = board.rows;

        const promises: Promise<void>[] = [];

        for (let i = 0; i < this.reels.length; i++) {
            const reel = this.reels[i];

            const extra = Math.floor(Math.random() * 3);
            const spinCycles = 10 + i * 5 + extra;

            const totalSymbols = reel.symbols.length;
            const backendStartIndex = totalSymbols - visible - 1;

            const targetPosition =
                spinCycles * totalSymbols + backendStartIndex;

            reel.target = targetPosition;

            const duration = 2500 + i * 600 + extra * 600;

            promises.push(
                this.tweenReelTo(
                    reel,
                    "position",
                    targetPosition,
                    duration,
                    this.easeBackout(0.5)
                )
            );
        }

        await Promise.all(promises);
    }

    private updateReels() {
        const tileSize = this.match3.board.tileSize;

        for (const reel of this.reels) {
            reel.previousPosition = reel.position;
            const total = reel.symbols.length;

            for (let i = 0; i < total; i++) {
                const s = reel.symbols[i];
                const localIndex = (reel.position + i) % total;
                s.y = localIndex * tileSize;
            }
        }
    }

    // -----------------------------------------------------
    // FINAL GRID WRITE
    // -----------------------------------------------------
    private setFinalGridState(types: number[][], multipliers: number[][]) {
        const board = this.match3.board;

        board.grid = types.map(row => [...row]);  
        board.multiplierGrid = multipliers.map(row => [...row]);

        console.log("🧩 Logical grid + multiplier grid updated.");
    }

    // -----------------------------------------------------
    // UPDATE BOARD PIECES
    // -----------------------------------------------------
    private updateBoardPiecesFromReels() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        board.pieces = [];

        for (let c = 0; c < this.reels.length; c++) {
            const reel = this.reels[c];

            for (let r = 0; r < board.rows; r++) {
                const symbol = reel.symbols[r + 1];

                symbol.row = r;
                symbol.column = c;
                symbol.x = 0;
                symbol.y = r * tileSize;

                board.pieces.push(symbol);
            }
        }

        console.log("🔄 board.pieces updated from reels.");
    }

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

    // -----------------------------------------------------
    // CLEAR BACKEND SYMBOLS
    // -----------------------------------------------------
    private clearBackendSymbols() {
        const board = this.match3.board;
        const visible = board.rows;

        for (const reel of this.reels) {
            while (reel.symbols.length > visible + 2) {
                const s = reel.symbols.pop()!;
                gsap.to(s, {
                    alpha: 0,
                    duration: 0.15,
                    onComplete: () => {
                        reel.container.removeChild(s);
                        s.destroy();
                    }
                });
            }
        }
    }

    public async stop() {
        this.processing = false;
    }
}
