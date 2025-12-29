import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import { userSettings } from "../utils/userSettings";

import {
    RoundResult,
    slotEvaluateClusterWins,
    flattenClusterPositions,
    mergeWildType,
    mergeNonZero,
    mergeReels,
    calculateTotalWin,
    gridZeroReset,
    countScatterBonus
} from "./SlotUtility";

export interface BackendSpinResult {
    reels: number[][];
    multiplierReels: number[][];
    bonusReels: number[][];
}
export type GridPosition = { row: number; column: number };

type SpinModeDelays = {
    minSpinMs: number;        // delay while spinning (min spin time)
    betweenWinMs: number;     // delay BEFORE next spin if there was a win
    betweenNoWinMs: number;   // delay BEFORE next spin if no win
};

export class Match3Process {
    protected match3: Match3;
    protected processing = false;
    protected round = 0;
    protected queue: AsyncQueue;
    public onProcessComplete?: () => void;

    protected cancelToken: { cancelled: boolean } | null = null;

    protected roundWin = 0;
    protected roundResult: RoundResult = [];
    protected winningPositions: GridPosition[] | null = null;
    protected wildReels: number[][] = [];

    protected delayRemainingMs = 0;
    protected delayResolver: (() => void) | null = null;
    protected delayToken: { cancelled: boolean } | null = null;

    protected bonusReels = gridZeroReset();

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();
    }

    protected async fetchBackendSpin(): Promise<BackendSpinResult> {
        return BetAPI.spin("n");
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

        this.match3.onProcessComplete?.();
    }

    public updateStats() {
        // TODO
    }

    /**
     * Centralized mapping: spinMode -> spin timing
     * You can tweak all delays here and both normal + free spins will follow.
     */
    protected getSpinModeDelays(): SpinModeDelays {
        const mode = userSettings.getSpinMode();

        // defaults for "normal-spin"
        let delays: SpinModeDelays = {
            minSpinMs: 800,
            betweenWinMs: 4000,
            betweenNoWinMs: 2300,
        };

        if (mode === "quick-spin") {
            delays = {
                minSpinMs: 600,
                betweenWinMs: 3500,
                betweenNoWinMs: 2000,
            };
        } else if (mode === "turbo-spin") {
            delays = {
                minSpinMs: 400,
                betweenWinMs: 3500,
                betweenNoWinMs: 1000,
            };
        }

        return delays;
    }

    public async start() {
        if (this.processing) return;

        const t0 = performance.now();
        console.log("SPIN STARTED");

        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const mode = userSettings.getSpinMode();
        const { minSpinMs, betweenWinMs, betweenNoWinMs } = this.getSpinModeDelays();

        await this.match3.board.startSpin();

        const t1 = performance.now();
        console.log(`after startSpin(): ${(t1 - t0).toFixed(2)} ms`);

        // Fetch backend + dynamic delay based on spinMode
        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        const t2 = performance.now();
        console.log("reels received from backend:", result.reels);
        console.log(
            `Interval (SPIN STARTED → reels received): ${(t2 - t0).toFixed(2)} ms`
        );

        // Only wait the delay if we actually configured one
        if (minSpinMs > 0) {
            await delayPromise;
        }

        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        // setting the bonusReels
        this.bonusReels = result.bonusReels;
        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runProcessRound();
        await this.match3.board.finishSpin();
        this.match3.board.clearWildLayerAndMultipliers();


        // Turbo post-spin delay
        if (mode === "turbo-spin") {
            const afterMs = this.roundWin > 0 ? betweenWinMs : betweenNoWinMs;
            if (afterMs > 0) {
                await this.createCancelableDelay(afterMs, token);

                if (!this.processing || token.cancelled) {
                    this.processing = false;
                    return;
                }
            }
        }

        this.processing = false;
        await this.match3.onProcessComplete?.();
    }


    public runProcessRound(): void {
        this.round++;

        this.queue.add(async () => this.checkBonus(this.bonusReels));
        this.queue.add(async () => this.setRoundResult());
        this.queue.add(async () => this.setRoundWin());
        this.queue.add(async () => this.setWinningPositions());

    }

    public checkBonus(reels: number[][]): void {
        console.log("checking bonus: ", countScatterBonus(reels))
        // if the  bonus condition satisfied, proceed to play the free spin won. 
        // show the banner with the number of free spin won
        

        // reset the bonus reels
        this.bonusReels = gridZeroReset();
    }

    protected setRoundResult() {
        const reels = this.match3.board.getBackendReels();
        const multipliers = this.match3.board.getBackendMultipliers();
        // merge with the wild reels
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    protected setWinningPositions() {
        const winningCluster =
            this.roundResult?.map((r) => ({ positions: r.positions })) ?? [];
        this.winningPositions = flattenClusterPositions(winningCluster);
    }

    protected createCancelableDelay(
        ms: number,
        token: { cancelled: boolean }
    ): Promise<void> {
        // If there’s already a pending delay, resolve it to avoid deadlocks.
        if (this.delayResolver) {
            const prev = this.delayResolver;
            this.clearDelay();
            prev();
        }

        this.delayRemainingMs = ms;
        this.delayToken = token;

        return new Promise((resolve) => {
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

    public mergeMultipliers(current: number[][], incoming: number[][]): number[][] {
        return mergeNonZero(current, incoming);
    }

    public mergeReels(current: number[][], incoming: number[][]): number[][] {
        return mergeReels(current, incoming);
    }

    public setMergeStickyWilds(current: number[][], incoming: number[][]): void {
        this.wildReels = mergeWildType(current, incoming);
    }

    public setRoundWin() {
        const bet = userSettings.getBet();
        this.roundWin = calculateTotalWin(this.roundResult, bet);
        console.log("Round Win: " + this.roundWin);
    }

    public getRoundWin() {
        return this.roundWin;
    }

    // function here to set clear the wild reels and the multiplier reels from the match3 board
    // this function will be called after every spin
    // for the extended free spin process it will be called at the end of the recursion
}
