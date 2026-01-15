import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import { userSettings, config, FreeSpinSetting, features } from "../utils/userSettings";
import { ConfigAPI } from "../api/configApi";
import {
    RoundResult,
    slotEvaluateClusterWins,
    flattenClusterPositions,
    mergeWildType,
    mergeNonZero,
    mergeReels,
    calculateTotalWin,
    gridZeroReset,
    countScatterBonus,
    getmaxWin,
} from "./SlotUtility";
import { userStats } from "../utils/userStats";
import { GameServices } from "../api/services";

export interface BackendSpinResult {
    reels: number[][];
    multiplierReels: number[][];
    bonusReels: number[][];
}
export type GridPosition = { row: number; column: number };

type SpinModeDelays = {
    minSpinMs: number;
    betweenWinMs: number;
    betweenNoWinMs: number;
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
    protected bonus = 0; //number of detected bonus symbol or badge in the reels

    protected delayRemainingMs = 0;
    protected delayResolver: (() => void) | null = null;
    protected delayToken: { cancelled: boolean } | null = null;

    protected reels = gridZeroReset();
    protected multiplierReels = gridZeroReset();
    protected bonusReels = gridZeroReset();

    // ✅ Pause gate (process-level)
    protected paused = false;
    protected pauseResolver: (() => void) | null = null;
    protected pausePromise: Promise<void> | null = null;

    // feature integer code
    protected featureCode = 0;

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

    public isPaused() {
        return this.paused;
    }

    public reset() {
        this.processing = false;

        // pause safety reset
        this.paused = false;
        this.pauseResolver = null;
        this.pausePromise = null;

        // cancel safety reset
        this.cancelToken = null;

        // clear any queued tasks
        this.queue.clear();

        // clear pending delay
        if (this.delayToken) this.delayToken.cancelled = true;
    }

    public async waitIfPaused(): Promise<void> {
        if (!this.paused) return;

        if (!this.pausePromise) {
            this.pausePromise = new Promise<void>((resolve) => {
                this.pauseResolver = resolve;
            });
        }

        await this.pausePromise;
    }

    public update(deltaMS: number) {
        // ✅ freeze delay countdown while paused
        if (this.paused) return;

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
        if (this.cancelToken) this.cancelToken.cancelled = true;
        if (this.delayToken) this.delayToken.cancelled = true;
    }

    public pause() {
        if (this.paused) return;
        this.paused = true;

        // ✅ pause the queue too (your AsyncQueue supports this)
        this.queue.pause();

        if (!this.pausePromise) {
            this.pausePromise = new Promise<void>((resolve) => {
                this.pauseResolver = resolve;
            });
        }
    }

    public resume() {
        if (!this.paused) return;
        this.paused = false;

        this.queue.resume();

        const r = this.pauseResolver;
        this.pauseResolver = null;
        this.pausePromise = null;
        r?.();
    }

    public stop() {
        if (!this.processing) return;

        this.processing = false;
        this.queue.clear();

        // ensure any pending delay resolves so start() can unwind safely
        if (this.delayToken) this.delayToken.cancelled = true;

        // unblock waiters if stop happens while paused
        if (this.paused) this.resume();

        this.match3.onProcessComplete?.();
    }

    protected getSpinModeDelays(): SpinModeDelays {
        const mode = userSettings.getSpinMode();

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
                betweenWinMs: 1500,
                betweenNoWinMs: 1000,
            };
        }

        return delays;
    }

    protected createCancelableDelay(ms: number, token: { cancelled: boolean }): Promise<void> {
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

    protected async pauseAwareDelay(ms: number, token?: { cancelled: boolean }): Promise<void> {
        if (ms <= 0) return;
        const t = token ?? this.cancelToken ?? { cancelled: false };
        await this.createCancelableDelay(ms, t);
        await this.waitIfPaused();
    }

    private clearDelay() {
        this.delayRemainingMs = 0;
        this.delayResolver = null;
        this.delayToken = null;
    }

    public async start() {
        if (this.processing) return;

        //update the user balance here to sync with the credit value of the control panel
        userSettings.setBalance(userSettings.getBalance() - userSettings.getBet());
        this.match3.onSpinStart?.();

        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const mode = userSettings.getSpinMode();
        const { minSpinMs, betweenWinMs, betweenNoWinMs } = this.getSpinModeDelays();

        await this.waitIfPaused();

        await this.match3.board.startSpin();

        const PirateApiResponse = await GameServices.spin(this.featureCode);

        // Fetch backend + dynamic delay based on spinMode
        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        if (minSpinMs > 0) {
            await delayPromise;
        }

        await this.waitIfPaused();

        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        // setting the 3 layers reels
        // this.reels = result.reels;
        // this.multiplierReels = result.multiplierReels;
        // this.bonusReels = result.bonusReels;

        this.reels = PirateApiResponse.data.reels;
        this.multiplierReels = PirateApiResponse.data.multiplierReels;
        this.bonusReels = PirateApiResponse.data.bonusReels;

        this.match3.board.applyBackendResults(this.reels, this.multiplierReels);

        await this.runProcessRound();

        await this.waitIfPaused();

        await this.match3.board.finishSpin();
        this.match3.board.clearWildLayerAndMultipliers();

        // Turbo post-spin delay (only turbo does this in your base)
        if (mode === "turbo-spin") {
            const afterMs = this.roundWin > 0 ? betweenWinMs : betweenNoWinMs;
            if (afterMs > 0) {
                await this.pauseAwareDelay(afterMs, token);
                if (!this.processing || token.cancelled) {
                    this.processing = false;
                    return;
                }
            }
        }

        this.processing = false;
        await this.match3.onProcessComplete?.();
    }

   
    public async runProcessRound(): Promise<void> {
        this.round++;

        await this.waitIfPaused();

        // build steps without auto-running each add()
        await this.queue.add(async () => this.checkBonus(this.reels), false);
        await this.queue.add(async () => this.setRoundResult(), false);
        await this.queue.add(async () => this.setRoundWin(), false);

        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    public checkBonus(reels: number[][]): void {
        const checked_result = countScatterBonus(reels);
        this.bonus = checked_result.count;
        this.match3.board.setBonusPositions(checked_result.positions);
        this.bonusReels = gridZeroReset();
    }

    public rewardBonusCheckpoint() { 
        const freeSpins = config.settings.features;
        const minBonusCount = Math.min(...freeSpins.map((item: features) => item.scatters));
        if (this.bonus >= minBonusCount){ // will get 2x bet reward if there is valid bonus appearance
            const bonusReward =  userSettings.getBet() * 2;
            console.log("check bonusReward in rewardBonusCheckpoint: ", bonusReward);
            return bonusReward;
        }

        return 0;
    }

    protected setRoundResult() {
        const reels = this.match3.board.getBackendReels();
        const multipliers = this.match3.board.getBackendMultipliers();
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    protected setWinningPositions() {
        const winningCluster = this.roundResult?.map((r) => ({ positions: r.positions })) ?? [];
        this.winningPositions = flattenClusterPositions(winningCluster);
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
        const roundWin = calculateTotalWin(this.roundResult, bet) + this.rewardBonusCheckpoint();  // express as total wins + reward if there is
        this.roundWin = roundWin >= getmaxWin() ? getmaxWin() : roundWin;
        userSettings.setBalance(userSettings.getBalance() + this.roundWin);
    }

    public getRoundWin() {
        return this.roundWin;
    }

    protected async getConfig() {
        return ConfigAPI.config();
    }

    public async getSpinWon() {
        // exported config from userSettings that fetches slot configuration
        const freeSpinsArray = config.settings.features;

        const freeSpinSettings = freeSpinsArray
            .filter((item: features) => item.scatters <= this.bonus)
            .sort((a: features, b: features) => b.scatters - a.scatters)[0];

        const spins = freeSpinSettings?.spins ?? 0;

        this.bonus = 0;
        return spins;
    }

}
