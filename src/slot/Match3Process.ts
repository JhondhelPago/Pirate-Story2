import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import { userSettings } from "../utils/userSettings"; 
import { RoundResult, slotEvaluateClusterWins, flattenClusterPositions, mergeWildType, mergeNonZero, mergeReels, calculateTotalWin } from "./SlotUtility";

export interface BackendSpinResult {
    reels: number[][];
    bonusReels: number[][];
}
export type GridPosition = { row: number; column: number };

export class Match3Process {
    protected match3: Match3;
    protected processing = false;
    protected round = 0;
    protected queue: AsyncQueue;
    public onProcessComplete?: () => void;

    protected cancelToken: { cancelled: boolean } | null = null;

    protected roundWin = 0;
    protected roundResult: RoundResult | null = null;
    protected winningPositions: GridPosition[] | null = null;
    protected wildReels: number[][] = [];
    
    protected delayRemainingMs = 0;
    protected delayResolver: (() => void) | null = null;
    protected delayToken: { cancelled: boolean } | null = null;
    
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
        
        console.log("[Match3] Sequence rounds:", this.round);
        console.log("[Match3] ======= PROCESSING COMPLETE =======");
        this.match3.onProcessComplete?.();
    }
    
    public updateStats() {
        // TODO
    }

    public async start() {
        if (this.processing) return;
        this.processing = true;

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
        this.match3.onProcessComplete?.();
    }

    public runProcessRound(): void {
        this.round++;

        this.queue.add( async () => this.setRoundResult());
        this.queue.add( async () => this.setWinningPositions());
        this.queue.add( async () => this.setMergeStickyWilds( this.match3.board.getWildReels(), this.match3.board.getBackendReels()));

    }

    protected setRoundResult(){
        const reels = this.match3.board.getBackendReels();
        const multipliers = this.match3.board.getBackendMultipliers();
        // merge with the wild reels
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
        const debugRoundResult =
            this.roundResult?.map(r => ({
                type: r.type,
                count: r.count,
                multiplier: r.multiplier,
                positions: r.positions.map(p => `[${p.row},${p.column}]`),
            })) ?? [];
        console.log("roundResult:", debugRoundResult);
    }

    protected setWinningPositions(){
        const winningCluster = this.roundResult?.map(r => ({ positions: r.positions,})) ?? [];
        this.winningPositions = flattenClusterPositions(winningCluster);
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


    public mergeMultipliers( current: number[][], incoming: number[][]): number[][] {
        return mergeNonZero(current, incoming);
    }

    public mergeReels(
        current: number[][],
        incoming: number[][]
    ): number[][] {
        return mergeReels(current, incoming);
    }

    public setMergeStickyWilds( current: number[][], incoming: number[][]): void {
        this.wildReels = mergeWildType(current, incoming);
    }

    public setRoundWin(){
        const bet = userSettings.getBet();
        this.roundWin = calculateTotalWin(this.roundResult!, bet);
        console.log("Round Win: " + this.roundWin);
    }

    public getRoundWin() {
        return this.roundWin;
    }

}
