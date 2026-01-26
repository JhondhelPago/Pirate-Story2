import { GameServices } from '../api/services';
import { userSettings } from '../utils/userSettings';
import { Slot } from './Slot';
import { SlotProcess } from './SlotProcess';
import { calculateTotalWin, gridZeroReset } from './SlotUtility';

export class SlotAutoSpinProcess extends SlotProcess {
    constructor(match3: Slot) {
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

        console.log('current code: ', this.featureCode);

        //update the user balance here to sync with the credit value of the control panel
        userSettings.setBalance(userSettings.getBalance() - userSettings.getBet());

        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        this.match3.onAutoSpinRoundStart?.(this.currentSpin, this.remainingSpins);

        await this.waitIfPaused();
        await this.match3.board.startSpin();

        const PirateApiResponse = await GameServices.spin(this.featureCode);

        const backendPromise = this.fetchBackendSpin();
        const delayPromise = minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        if (minSpinMs > 0) {
            await delayPromise;
        }

        await this.waitIfPaused();

        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

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
