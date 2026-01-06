import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import {
    calculateTotalWin,
    countScatterBonus,
    gridZeroReset,
    slotEvaluateClusterWins,
} from "./SlotUtility";

export class Match3FreeSpinProcess extends Match3Process {
    constructor(match3: Match3) {
        super(match3);
    }

    protected freeSpinProcessing = false;

    private isInitialFreeSpin = false;

    private accumulatedWin = 0;
    private spins = 0;
    private remainingSpins = 0;
    private currentSpin = 0;

    private reelsTraversed = gridZeroReset();
    private multiplierTraversed = gridZeroReset();

    public async freeSpinStartInitialBonus() {
        if (this.processing) return;
        this.processing = true;

        this.isInitialFreeSpin = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        console.log("initial bonus spin trigger from free spin process");

        await this.waitIfPaused();
        await this.match3.board.startSpin();

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

        this.reels = result.reels;
        this.multiplierReels = result.multiplierReels;
        this.bonusReels = result.bonusReels;

        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runInitialBonusProcess();

        await this.waitIfPaused();
        await this.match3.board.finishSpin();

        this.processing = false;

        this.isInitialFreeSpin = false;

        await this.match3.onFreeSpinInitialBonusScatterComplete?.(this.spins);
    }

    // ✅ truly awaited, queue-based, pause-aware
    public async runInitialBonusProcess(): Promise<void> {
        await this.waitIfPaused();

        await this.queue.add(async () => this.checkBonus(this.reels), false);
        await this.queue.add(async () => {
            console.log(this.bonusReels);
        }, false);

        await this.queue.add(async () => {
            const checked_result = countScatterBonus(this.reels);
            console.log("checking bonus positions:", checked_result.positions);
            this.match3.board.setBonusPositions(checked_result.positions);
            this.bonusReels = gridZeroReset();
        }, false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    public processCheckpoint() {
        if (this.remainingSpins > 0) {
            this.remainingSpins--;
            this.currentSpin++;
            return true;
        }
        return false;
    }

    public async freeSpinStart() {
        this.isInitialFreeSpin = false;
        this.freeSpinProcessing = true;

        await this.waitIfPaused();

        if (!this.processCheckpoint()) {
            this.freeSpinProcessing = false;

            // ✅ CRITICAL FIX:
            // Await the callback (TotalWinBanner must finish/close)
            await this.match3.onFreeSpinComplete?.(this.currentSpin, this.remainingSpins);

            // Only reset AFTER the UI flow has finished
            this.reset();
            return;
        }

        await this.start();

        await this.delayBetweenSpins();

        await this.waitIfPaused();
        await this.freeSpinStart();
    }

    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        this.match3.onFreeSpinRoundStart?.(this.currentSpin, this.remainingSpins);

        await this.waitIfPaused();
        await this.match3.board.startSpin();

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

        this.reels = result.reels;
        this.multiplierReels = result.multiplierReels;
        this.bonusReels = result.bonusReels;

        this.reelsTraversed = this.mergeReels(this.reelsTraversed, result.reels);
        this.multiplierTraversed = this.mergeMultipliers(
            this.multiplierTraversed,
            result.multiplierReels
        );

        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runProcessRound();

        await this.waitIfPaused();
        await this.match3.board.finishSpin();

        this.processing = false;

        await this.match3.onFreeSpinRoundComplete?.();
    }

    public getBonusReels() {
        return this.bonusReels;
    }

    // ✅ override: queue-based, awaited, pause-aware
    public async runProcessRound(): Promise<void> {
        this.round++;

        await this.waitIfPaused();

        await this.queue.add(async () =>
            this.setMergeStickyWilds(
                this.match3.board.getWildReels(),
                this.match3.board.getBackendReels()
            ), false
        );

        await this.queue.add(async () => this.checkBonus(this.bonusReels), false);
        await this.queue.add(async () => this.setRoundResult(), false);
        await this.queue.add(async () => this.setRoundWin(), false);
        await this.queue.add(async () => this.addRoundWin(), false);
        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    protected setRoundResult() {
        const reels = this.reelsTraversed;
        const multipliers = this.multiplierTraversed;
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    public addRoundWin() {
        const totalRoundWin = calculateTotalWin(this.roundResult, userSettings.getBet());
        this.accumulatedWin += totalRoundWin;
    }

    public async getSpinWon() {
        const config = await this.getConfig();
        
        const freeSpinsArray = config.settings.extraFreeSpins;

        const freeSpinSettings = freeSpinsArray
            .filter(item => item.count <= this.bonus)
            .sort((a, b) => b.count - a.count)[0];

        const spins = freeSpinSettings?.spins ?? 0;

        this.bonus = 0;
        return spins;
    }    

    public setSpinRounds(spins: number) {
        this.spins = spins;
    }

    public setSpins(spins: number) {
        this.remainingSpins = spins;
    }

    public addSpins(spins: number) {
        this.remainingSpins += spins;
    }

    public getAccumulatedWin() {
        return this.accumulatedWin;
    }

    // ✅ pause-aware delay (replaces setTimeout)
    private async delayBetweenSpins() {
        const hasWin = this.roundResult.length > 0;
        const { betweenWinMs, betweenNoWinMs } = this.getSpinModeDelays();
        const ms = hasWin ? betweenWinMs : betweenNoWinMs;

        await this.pauseAwareDelay(ms);
    }

    public getFreeSpinProcessing() {
        return this.freeSpinProcessing;
    }

    public getIsInitialFreeSpin() {
        return this.isInitialFreeSpin;
    }

    public reset() {
        this.wildReels = gridZeroReset();
        this.match3.board.setWildReels(this.wildReels);

        this.match3.board.clearWildLayerAndMultipliers();
        this.match3.board.rebuildReelsAndAnimatePositions(
            this.reelsTraversed,
            this.multiplierTraversed,
            this.winningPositions!
        );

        this.winningPositions = [];

        this.reelsTraversed = gridZeroReset();
        this.multiplierTraversed = gridZeroReset();

        this.currentSpin = 0;
        this.remainingSpins = 0;
        this.accumulatedWin = 0;

        this.isInitialFreeSpin = false;

        super.reset();
    }
}
