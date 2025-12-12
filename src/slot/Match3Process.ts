import { roundPixelsBit } from "pixi.js";
import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import { RoundResult, slotEvaluateClusterWins, mergeClusterPositions } from "./SlotUtility";

export interface BackendSpinResult {
    reels: number[][];
    bonusReels: number[][];
}
export type GridPosition = { row: number; column: number };

export class Match3Process {
    private match3: Match3;
    private processing = false;

    private round = 0;

    private queue: AsyncQueue;

    private cancelToken: { cancelled: boolean } | null = null;

    private roundResult: RoundResult | null = null;
    private winningPositions: GridPosition[] | null = null;

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();
    }

    public isProcessing() {
        return this.processing;
    }

    public reset() {
        this.processing = false;
    }

    public interruptSpinDelay() {
        if (this.cancelToken) {
            this.cancelToken.cancelled = true;
        }
    }

    public pause() {
        this.queue.pause();
    }

    public resume() {
        this.queue.resume();
    }

    public stop() {
        if (!this.processing) return;
        this.processing = false;
        this.queue.clear();
        console.log("[Match3] Sequence rounds:", this.round);
        console.log("[Match3] ======= PROCESSING COMPLETE =======");
        this.match3.onProcessComplete?.();
    }

    public async start() {
        if (this.processing) {
            return;
        }

        this.processing = true;
        this.match3.onProcessStart?.();

        const token = { cancelled: false };
        this.cancelToken = token;

        await this.match3.board.startSpin();

        const backendPromise = this.fetchBackendSpin();
        const delayPromise = this.createCancelableDelay(1000, token); // 1s min delay
        const result = await backendPromise;
        await delayPromise;

        this.match3.board.applyBackendResults(result.reels, result.bonusReels);

        // evaluate wins and wait for queue work to finish
        await this.runProcessRound();

        await this.match3.board.finishSpin();

        this.processing = false;
    }

    public async runProcessRound(): Promise<void> {
        // IMPORTANT: return the promise from queue.add
        return this.queue.add(async () => {
            this.round += 1;

            const reels = this.match3.board.getBackendReels();
            const multipliers = this.match3.board.getBackendMultipliers();

            this.roundResult = slotEvaluateClusterWins(reels, multipliers);

            const winningCluster =
                this.roundResult?.map(r => ({
                    positions: r.positions,
                })) ?? [];

            const winningPositions = mergeClusterPositions(winningCluster);
            this.winningPositions = winningPositions;

            // update stats here
        });
    }

    public updateStats() {
        // TODO
    }

    public processCheckpoint() {
        // TODO
    }

    private createCancelableDelay(ms: number, token: { cancelled: boolean }): Promise<void> {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                resolve(); // delay finished normally
            }, ms);

            // If delay is cancelled early → skip the wait
            const check = setInterval(() => {
                if (token.cancelled) {
                    clearTimeout(timer);
                    clearInterval(check);
                    resolve(); // resolve immediately
                }
            }, 10);
        });
    }

    public getWinningPositions() {
        return this.winningPositions;
    }

    public getRoundResult() {
        return this.roundResult;
    }

    private async fetchBackendSpin(): Promise<BackendSpinResult> {
        return BetAPI.spin("n");
    }
}
