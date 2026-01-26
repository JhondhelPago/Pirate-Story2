import { userSettings } from '../utils/userSettings';
import { Slot } from './Slot';
import { SlotProcess } from './SlotProcess';
import { config, FreeSpinSetting } from '../utils/userSettings';
import {
    calculateTotalWin,
    countScatterBonus,
    getmaxWin,
    gridZeroReset,
    isMaxWin,
    slotEvaluateClusterWins,
} from './SlotUtility';
import { GameServices } from '../api/services';

export class SlotFreeSpinProcess extends SlotProcess {
    constructor(match3: Slot) {
        super(match3);
    }

    protected freeSpinProcessing = false;

    private isInitialFreeSpin = false;

    private accumulatedWin = 0;
    private spins = 0;
    private remainingSpins = 0;
    private currentSpin = 0;
    private forfeited = false;

    private benefit = 0;

    private reelsTraversed = gridZeroReset();
    private multiplierTraversed = gridZeroReset();

    public async freeSpinStartInitialBonus() {
        if (this.processing) return;
        this.processing = true;

        this.isInitialFreeSpin = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        console.log('initial bonus spin trigger from free spin process');

        await this.waitIfPaused();
        await this.match3.board.startSpin();

        const PirateApiResponse = await GameServices.spin(this.featureCode);
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

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

        await this.runInitialBonusProcess();

        await this.waitIfPaused();
        await this.match3.board.finishSpin();

        this.processing = false;

        await this.match3.onFreeSpinInitialBonusScatterComplete?.(this.spins);
    }

    // ✅ truly awaited, queue-based, pause-aware
    public async runInitialBonusProcess(): Promise<void> {
        await this.waitIfPaused();

        await this.queue.add(async () => this.checkBonus(this.reels), false);
        await this.queue.add(async () => {
            // in this block give intial win for the user, doubling the bet
            console.log(this.bonusReels);
            this.accumulatedWin = userSettings.getBet() * 2;
        }, false);
        await this.queue.add(async () => this.setRoundResultInitial(), false);
        await this.queue.add(async () => this.setRoundWin(), false);
        await this.queue.add(async () => this.addRoundWin(), false);
        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.add(async () => {
            const checked_result = countScatterBonus(this.reels);
            console.log('checking bonus positions:', checked_result.positions);
            this.match3.board.setBonusPositions(checked_result.positions);
            this.bonusReels = gridZeroReset();
        }, false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    public processCheckpoint() {
        console.log('remainingSpins: ', this.remainingSpins);
        // if (isMaxWin(this.accumulatedWin)) { // utility function here the return boolean value, evaluating the the max win
        //     console.log('free spin process forfitied.');
        //     return false;

        if (this.forfeited) {
            // server makes invalid index means to hit the max win and forfetied spins
            console.log('free spin process forfitied.');
            return false;
        } else if (this.remainingSpins > 0) {
            this.remainingSpins--;
            this.currentSpin++;
            return true;
        }
        return false;
    }

    /**
     * ✅ Converted from recursion to a while-loop.
     * Logic is intentionally kept the same:
     * - Each iteration:
     *   - waits if paused
     *   - checks checkpoint / forfeited (end flow)
     *   - runs one spin via start()
     *   - delays between spins
     * - On end (checkpoint fail OR forfeited OR start() throws):
     *   - credit accumulated win
     *   - await onFreeSpinComplete
     *   - reset after UI flow finished
     */
    public async freeSpinStart() {
        this.isInitialFreeSpin = false;
        this.freeSpinProcessing = true;

        while (true) {
            await this.waitIfPaused();

            if (!this.processCheckpoint() || this.forfeited) {
                this.freeSpinProcessing = false;

                console.log('inside the if block of the !this.processCheckpoint()');

                userSettings.setBalance(userSettings.getBalance() + this.accumulatedWin);

                // CRITICAL FIX:
                // Await the callback (TotalWinBanner must finish/close)
                await this.match3.onFreeSpinComplete?.(this.currentSpin, this.remainingSpins);

                // Only reset AFTER the UI flow has finished
                this.reset();
                return;
            }

            try {
                await this.start();
            } catch (error) {
                this.freeSpinProcessing = false;

                console.log('inside the if block of the catch error');

                userSettings.setBalance(userSettings.getBalance() + this.accumulatedWin);

                await this.match3.onFreeSpinComplete?.(this.currentSpin, this.remainingSpins);

                // Only reset AFTER the UI flow has finished
                this.reset();
                return;
            }

            await this.delayBetweenSpins();

            // next loop iteration continues the same as the old recursion:
            // await this.waitIfPaused();
            // await this.freeSpinStart();
        }
    }

    public async start() {
        try {
            if (this.processing) return;

            this.processing = true;

            const token = { cancelled: false };
            this.cancelToken = token;

            const { minSpinMs } = this.getSpinModeDelays();

            this.match3.onFreeSpinRoundStart?.(this.currentSpin, this.remainingSpins);

            await this.waitIfPaused();
            await this.match3.board.startSpin();

            const PirateApiResponse = await GameServices.spin(this.featureCode);
            this.benefit = PirateApiResponse.data.benefitAmount;

            const delayPromise =
                minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

            if (minSpinMs > 0) {
                await delayPromise;
            }

            await this.waitIfPaused();

            if (!this.processing || token.cancelled) {
                this.processing = false;
                return;
            }

            // ✅ Safe to use now
            this.reels = PirateApiResponse.data.reels;
            this.multiplierReels = PirateApiResponse.data.multiplierReels;
            this.bonusReels = PirateApiResponse.data.bonusReels;

            this.reelsTraversed = this.mergeReels(this.reelsTraversed, this.reels);
            this.multiplierTraversed = this.mergeMultipliers(
                this.multiplierTraversed,
                this.multiplierReels
            );

            this.match3.board.applyBackendResults(this.reels, this.multiplierReels);

            await this.runProcessRound();

            await this.waitIfPaused();
            await this.match3.board.finishSpin();

            this.processing = false;

            await this.match3.onFreeSpinRoundComplete?.();
        } catch (error) {
            console.error('Spin failed, forfeiting free spins:', error);

            this.forfeited = true;
            this.processing = false;

            // Important: finish the spin visually
            this.match3.board.applyBackendResults(this.reels, this.multiplierReels);
            await this.match3.board.finishSpin();
            console.log("board finsih visually");

            throw error;
        }
    }

    public async resumeStart() {
        const ResumeData = userSettings.getResumeData();

        // set the remaining spins
        this.setSpinRounds(ResumeData.freeSpins);
        this.setSpins(ResumeData.freeSpins);

        // this.reels = ResumeData?.reels;
        // this.multiplierReels = ResumeData?.multiplierReels;
        // this.bonusReels = ResumeData?.bonusReels;

        // this.reelsTraversed = this.mergeReels(this.reelsTraversed, this.reels);
        // this.multiplierTraversed = this.mergeMultipliers(this.multiplierTraversed, this.multiplierReels);

        // this.match3.board.applyBackendResults(this.reels, this.multiplierReels);

        console.log('from the resumeStart match3freespinprocess ', ResumeData);

        // this.match3.onFreeSpinResumeStart?.(this.remainingSpins);

        await this.resumeProcessRound();

        await this.waitIfPaused();
    }

    public async resumeProcessRound(): Promise<void> {
        await this.waitIfPaused();

        await this.queue.add(
            async () =>
                this.setMergeStickyWilds(
                    this.match3.board.getWildReels(),
                    this.match3.board.getBackendReels()
                ),
            false
        );

        await this.queue.add(async () => this.checkBonus(this.bonusReels), false);
        await this.queue.add(async () => this.setRoundResult(), false);
        await this.queue.add(async () => this.setRoundWin(), false);
        await this.queue.add(async () => this.addRoundWin(), false);
        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.process();

        await this.waitIfPaused();

        // keep original behavior (fire-and-forget)
        this.freeSpinStart();
    }

    // ✅ override: queue-based, awaited, pause-aware
    public async runProcessRound(): Promise<void> {
        this.round++;

        await this.waitIfPaused();

        await this.queue.add(
            async () =>
                this.setMergeStickyWilds(
                    this.match3.board.getWildReels(),
                    this.match3.board.getBackendReels()
                ),
            false
        );

        await this.queue.add(async () => this.checkBonus(this.bonusReels), false);
        await this.queue.add(async () => this.setRoundResult(), false);
        await this.queue.add(async () => this.setRoundWin(), false);
        await this.queue.add(async () => this.addRoundWin(), false);
        await this.queue.add(async () => this.setWinningPositions(), false);

        await this.queue.process();

        await this.waitIfPaused();
    }

    public getBonusReels() {
        return this.bonusReels;
    }

    public setRoundResultInitial() {
        const reels = this.match3.board.getBackendReels();
        const multipliers = this.match3.board.getBackendMultipliers();
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    protected setRoundResult() {
        const reels = this.reelsTraversed;
        console.log('reels in setRoundResult: ', reels);
        const multipliers = this.multiplierTraversed;
        console.log('multipliers in setRoundResult: ', multipliers);
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    // need an specific override for the rewardBonusCheckpoint here in the Match3FreeSpinProcess
    public rewardBonusCheckpoint() {
        const freeSpins = config.settings.extraFreeSpins;
        const minBonusCount = Math.min(...freeSpins.map((item: FreeSpinSetting) => item.count));
        if (this.bonus >= minBonusCount) {
            // will get 2x bet reward if there is valid bonus appearance
            const bonusReward = userSettings.getBet() * 2;
            console.log('check bonusReward in rewardBonusCheckpoint: ', bonusReward);
            return bonusReward;
        }

        return 0;
    }

    // override method without setting the balance, specific logic for the free spin process
    public setRoundWin() {
        const bet = userSettings.getBet();
        const roundWin = calculateTotalWin(this.roundResult, bet);
        const totalWin = roundWin + this.accumulatedWin;
        const isHitWinCap = isMaxWin(totalWin);

        if (isHitWinCap) {
            this.roundWin = getmaxWin() - this.accumulatedWin;
        } else {
            this.roundWin = roundWin;
        }
        console.log('Round Win: ' + this.roundWin);
        console.log('Benefit: ' + this.benefit);
    }

    public addRoundWin() {
        const totalWin = this.roundWin + this.accumulatedWin;
        console.log('totalWin: ', totalWin);
        const isHitWinCap = isMaxWin(totalWin);
        if (isHitWinCap) {
            this.forfeited = true;
            this.accumulatedWin = getmaxWin();
        } else {
            this.accumulatedWin += this.roundWin;
        }
    }

    public async getSpinWon() {
        // exported config from userSettings that fetches slot configuration
        const freeSpinsArray = config.settings.extraFreeSpins;

        const freeSpinSettings = freeSpinsArray
            .filter((item: FreeSpinSetting) => item.count <= this.bonus)
            .sort((a: FreeSpinSetting, b: FreeSpinSetting) => b.count - a.count)[0];

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

    public setupResume() {
        // set the userSettings.balance
        // set the userSettings.index for the spin index

        // set the tracked reels
        // set last reels, multipliers, bonus
    }
}
