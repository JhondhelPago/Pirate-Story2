import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import {
    calculateTotalWin,
    countScatterBonus,
    flattenClusterPositions,
    gridZeroReset,
    slotEvaluateClusterWins
} from "./SlotUtility";

export class Match3FreeSpinProcess extends Match3Process {
    constructor(match3: Match3) {
        super(match3);
    }

    // state flag for this continuous process
    protected freeSpinProcessing = false;

    // 🔹 TRUE only during the initial bonus spin
    private isInitialFreeSpin = false;

    private accumulatedWin = 0;
    private spins = 0;
    private remainingSpins = 0;
    private currentSpin = 0;

    private reelsTraversed = gridZeroReset();
    private multiplierTraversed = gridZeroReset();

    // =========================
    // INITIAL BONUS FREE SPIN
    // =========================
    public async freeSpinStartInitialBonus() {
        if (this.processing) return;
        this.processing = true;

        // 🔹 SET INITIAL SPIN FLAG
        this.isInitialFreeSpin = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        console.log("initial bonus spin trigger from free spin process");

        await this.match3.board.startSpin();

        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0
                ? this.createCancelableDelay(minSpinMs, token)
                : Promise.resolve();

        const result = await backendPromise;

        if (minSpinMs > 0) {
            await delayPromise;
        }

        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        this.reels = result.reels;
        this.multiplierReels = result.multiplierReels;
        this.bonusReels = result.bonusReels;

        this.match3.board.applyBackendResults(
            result.reels,
            result.multiplierReels
        );

        await this.runInitialBonusProcess();
        await this.match3.board.finishSpin();

        this.processing = false;

        // 🔹 UNSET INITIAL SPIN FLAG
        this.isInitialFreeSpin = false;

        await this.match3.onFreeSpinInitialBonusScatterComplete?.(this.spins);
    }

    // =========================
    // FREE SPIN LOOP CONTROL
    // =========================
    public processCheckpoint() {
        if (this.remainingSpins > 0) {
            this.remainingSpins--;
            this.currentSpin++;
            return true;
        }
        return false;
    }

    public async freeSpinStart() {
        // 🔹 ACTUAL FREE SPINS START HERE
        this.isInitialFreeSpin = false;
        this.freeSpinProcessing = true;

        if (!this.processCheckpoint()) {
            this.freeSpinProcessing = false;

            this.match3.onFreeSpinComplete?.(
                this.currentSpin,
                this.remainingSpins
            );

            this.reset();
            return;
        }

        await this.start();
        await this.delayBetweenSpins();
        await this.freeSpinStart();
    }

    // =========================
    // ONE FREE SPIN ROUND
    // =========================
    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const { minSpinMs } = this.getSpinModeDelays();

        this.match3.onFreeSpinRoundStart?.(
            this.currentSpin,
            this.remainingSpins
        );

        await this.match3.board.startSpin();

        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0
                ? this.createCancelableDelay(minSpinMs, token)
                : Promise.resolve();

        const result = await backendPromise;

        if (minSpinMs > 0) {
            await delayPromise;
        }

        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        this.reels = result.reels;
        this.multiplierReels = result.multiplierReels;
        this.bonusReels = result.bonusReels;

        const reelsTraversed = this.mergeReels(
            this.reelsTraversed,
            result.reels
        );
        this.reelsTraversed = reelsTraversed;

        const multiplierTraversed = this.mergeMultipliers(
            this.multiplierTraversed,
            result.multiplierReels
        );
        this.multiplierTraversed = multiplierTraversed;

        this.match3.board.applyBackendResults(
            result.reels,
            result.multiplierReels
        );

        await this.runProcessRound();
        await this.match3.board.finishSpin();

        this.processing = false;

        await this.match3.onFreeSpinRoundComplete?.();
    }

    // =========================
    // BONUS / ROUND LOGIC
    // =========================
    public getBonusReels() {
        return this.bonusReels;
    }

    public runInitialBonusProcess() {
        this.queue.add(async () => this.checkBonus(this.reels));
        this.queue.add(async () => {
            console.log(this.bonusReels);
        });

        this.queue.add(async () => {
            const checked_result = countScatterBonus(this.reels);
            console.log("checking bonus positions:", checked_result.positions);
            this.match3.board.setBonusPositions(checked_result.positions);
            this.bonusReels = gridZeroReset();
        });
    }

    public runProcessRound(): void {
        this.round++;

        this.queue.add(async () =>
            this.setMergeStickyWilds(
                this.match3.board.getWildReels(),
                this.match3.board.getBackendReels()
            )
        );

        this.queue.add(async () => this.checkBonus(this.bonusReels));
        this.queue.add(async () => this.setRoundResult());
        this.queue.add(async () => this.setRoundWin());
        this.queue.add(async () => this.addRoundWin());
        this.queue.add(async () => this.setWinningPositions());
    }

    protected setRoundResult() {
        const reels = this.reelsTraversed;
        const multipliers = this.multiplierTraversed;
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
    }

    public addRoundWin() {
        const totalRoundWin = calculateTotalWin(
            this.roundResult,
            userSettings.getBet()
        );
        this.accumulatedWin += totalRoundWin;
    }

    public setSpinRounds(spins: number) {
        this.spins = spins;
    }

    public setSpins(spins: number) {
        this.remainingSpins = spins;
    }

    public getAccumulatedWin() {
        return this.accumulatedWin;
    }

    private async delayBetweenSpins() {
        const hasWin = this.roundResult.length > 0;
        const { betweenWinMs, betweenNoWinMs } = this.getSpinModeDelays();
        const ms = hasWin ? betweenWinMs : betweenNoWinMs;

        if (ms <= 0) return;
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    // =========================
    // GETTERS
    // =========================
    public getFreeSpinProcessing() {
        return this.freeSpinProcessing;
    }

    public getIsInitialFreeSpin() {
        return this.isInitialFreeSpin;
    }

    // =========================
    // RESET
    // =========================
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

        // 🔹 RESET FLAG SAFETY
        this.isInitialFreeSpin = false;
    }
}
