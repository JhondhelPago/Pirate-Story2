import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import { calculateTotalWin, gridZeroReset } from "./SlotUtility";

export class Match3AutoSpinProcess extends Match3Process {
    constructor(match3: Match3) {
        super(match3);
    }

    protected autoSpinProcessing = false;
    private accumulatedWin = 0;
    private remainingSpins = 0;
    private currentSpin = 0;

    public processCheckpoint() {
        if (this.remainingSpins > 0) {
            this.remainingSpins--;
            this.currentSpin++;
            return true;
        }
        return false;
    }

    public async autoSpinStart() {
        this.autoSpinProcessing = true;

        await this.waitIfPaused();

        if (!this.processCheckpoint()) {
            this.autoSpinProcessing = false;

            this.match3.onAutoSpinComplete?.(this.currentSpin, this.remainingSpins);

            this.reset();
            return;
        }

        await this.start();

        await this.delayBetweenSpins();

        await this.waitIfPaused();
        await this.autoSpinStart();
    }

    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        this.match3.onAutoSpinRoundStart?.(this.currentSpin, this.remainingSpins);

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

        await this.runProcessRound();

        await this.waitIfPaused();
        await this.match3.board.finishSpin();

        this.processing = false;

        await this.match3.onAutoSpinRoundComplete?.();
    }

    // ✅ override: queue-based, awaited, pause-aware
    public async runProcessRound(): Promise<void> {
        this.round++;

        await this.waitIfPaused();

        // checkBonushere
        await this.queue.add(async () => this.checkBonus(this.reels), false);
        await this.queue.add(async () => this.setRoundResult(), false);
        await this.queue.add(async () => this.setRoundWin(), false);
        await this.queue.add(async () => this.addRoundWin(), false);
        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    public addRoundWin() {
        const totalRoundWin = calculateTotalWin(this.roundResult, userSettings.getBet());
        this.accumulatedWin += totalRoundWin;
    }

    public setSpins(spins: number) {
        this.remainingSpins = spins;
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

    public getAutoSpinProcessing() {
        return this.autoSpinProcessing;
    }

    public getFreeSpinWon() {
        let spins = 0;

        if (this.bonus >= 4) spins = 5;
        // else if (this.bonus === 4) spins = 10;
        // else if (this.bonus === 5) spins = 15;

        this.bonus = 0;
        return spins;
    }


    public reset() {
        this.wildReels = gridZeroReset();
        this.match3.board.setWildReels(this.wildReels);
        this.match3.board.clearWildLayerAndMultipliers();

        this.currentSpin = 0;
        this.remainingSpins = 0;
        this.accumulatedWin = 0;

        super.reset();
    }
}
