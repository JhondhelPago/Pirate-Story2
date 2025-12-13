import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import { RoundResult, slotEvaluateClusterWins, flattenClusterPositions, mergeWildType, mergeNonZero, mergeReels } from "./SlotUtility";

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
    private wildReels: number[][] = [];

    private delayRemainingMs = 0;
    private delayResolver: (() => void) | null = null;
    private delayToken: { cancelled: boolean } | null = null;

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

    public update(deltaMS: number) {
        if (this.delayResolver && this.delayToken) {
            // if cancelled, resolve immediately
            if (this.delayToken.cancelled) {
                const resolve = this.delayResolver;
                this.clearDelay();
                resolve();
                return;
            }

            this.delayRemainingMs -= deltaMS;
            if (this.delayRemainingMs <= 0) {
                const resolve = this.delayResolver;
                this.clearDelay();
                resolve();
            }
        }
    }

    public interruptSpinDelay() {
        if (this.cancelToken) {
            this.cancelToken.cancelled = true;
        }
        // Also cancel any active ticker-based delay right now
        if (this.delayToken) {
            this.delayToken.cancelled = true;
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

        // ensure any pending delay resolves so start() can unwind safely
        if (this.delayToken) {
            this.delayToken.cancelled = true;
        }

        console.log("[Match3] Sequence rounds:", this.round);
        console.log("[Match3] ======= PROCESSING COMPLETE =======");
        this.match3.onProcessComplete?.();
    }

    public async start() {
        if (this.processing) return;

        this.processing = true;
        this.match3.onProcessStart?.();

        const token = { cancelled: false };
        this.cancelToken = token;

        await this.match3.board.startSpin();

        // Fetch backend + enforce minimum delay (ticker-driven)
        const backendPromise = this.fetchBackendSpin();
        const delayPromise = this.createCancelableDelay(1500, token); // 1s min delay

        const result = await backendPromise;
        if (!this.match3.board.getTurboSpin()) {
            await delayPromise;
        }

        // If the whole process was stopped/cancelled during wait, bail cleanly
        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        const reelsTraversed = this.mergeReels(this.match3.board.getBackendReels(), result.reels)
        const multiplierTraversed = this.mergeMultipliers(this.match3.board.getBackendMultipliers(), result.bonusReels)
        this.match3.board.applyBackendResults(reelsTraversed, multiplierTraversed);
        // this.match3.board.applyBackendResults(result.reels, result.bonusReels);
        
        await this.runProcessRound();
        await this.match3.board.finishSpin();

        this.processing = false;
    }

    public async runProcessRound(): Promise<void> {
        return this.queue.add(async () => {
            this.round += 1;
            
            // update stats here
            const reels = this.match3.board.getBackendReels();
            const multipliers = this.match3.board.getBackendMultipliers();


            // virtual grid here to evaluate for the result
            // merge with the wild reels

            this.roundResult = slotEvaluateClusterWins(reels, multipliers);

            const winningCluster =
                this.roundResult?.map(r => ({
                    positions: r.positions,
                })) ?? [];

            
            this.winningPositions = flattenClusterPositions(winningCluster);
            console.log("WINNING POSITIONS", this.winningPositions);

            // set the reference of the stiucky wild to this process object, it board will refrence to this
            this.wildReels = this.mergeStickyWilds(
                    this.match3.board.getWildReels(),
                    reels
                )

            console.log("wild Reels from Process", this.wildReels)
                
            });
    }

    public updateStats() {
        // TODO
    }

    public processCheckpoint() {
        // TODO
    }

    /**
     * Ticker-driven delay.
     * - Respects pause (because update(deltaMS) stops when your game loop stops)
     * - Can be cancelled via token.cancelled = true
     */
    private createCancelableDelay(ms: number, token: { cancelled: boolean }): Promise<void> {
        // If there’s already a pending delay, resolve it to avoid deadlocks.
        if (this.delayResolver) {
            const prev = this.delayResolver;
            this.clearDelay();
            prev();
        }

        this.delayRemainingMs = ms;
        this.delayToken = token;

        return new Promise(resolve => {
            // If already cancelled, resolve immediately
            if (token.cancelled) {
                this.clearDelay();
                resolve();
                return;
            }
            this.delayResolver = resolve;
        });
    }

    private clearDelay() {
        this.delayRemainingMs = 0;
        this.delayResolver = null;
        this.delayToken = null;
    }

    public getWinningPositions() {
        return this.winningPositions;
    }

    public getWildReels() {
        return this.wildReels;
    }

    public getRoundResult() {
        return this.roundResult;
    }

    private async fetchBackendSpin(): Promise<BackendSpinResult> {
        return BetAPI.spin("n");
    }

    private mergeMultipliers( current: number[][], incoming: number[][]): number[][] {
        return mergeNonZero(current, incoming);
    }

    private mergeReels(
        current: number[][],
        incoming: number[][]
    ): number[][] {
        return mergeReels(current, incoming);
    }

    private mergeStickyWilds( current: number[][], incoming: number[][]): number[][] {
        return mergeWildType(current, incoming);
    }


}
