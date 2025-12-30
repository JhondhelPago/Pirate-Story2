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

        if (!this.processCheckpoint()) {
            this.autoSpinProcessing = false;

            // use a bound callback here for the autoSpinComplete
            this.match3.onAutoSpinComplete?.(
                this.currentSpin,
                this.remainingSpins
            );

            this.reset();
            return; // free spin end session
        }


        await this.start();

        await this.delayBetweenSpins();

        await this.autoSpinStart();
    }

    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const spinMode = userSettings.getSpinMode();
        const { minSpinMs } = this.getSpinModeDelays();

        this.match3.onAutoSpinRoundStart?.(
            this.currentSpin,
            this.remainingSpins
        )



        await this.match3.board.startSpin();

        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        if (minSpinMs > 0) {
            await delayPromise;
        }


        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runProcessRound();
        await this.match3.board.finishSpin();

        this.processing = false;


        await this.match3.onAutoSpinRoundComplete?.();
    }

    public runProcessRound(): void {
        this.round++;

        this.queue.add(async () => this.setRoundResult());
        this.queue.add(async () => this.setRoundWin());
        this.queue.add(async () => this.addRoundWin());
        this.queue.add(async () => this.setWinningPositions());
    }

    public addRoundWin() {
        console.log("Remaining Spins: ", this.remainingSpins);
        console.log(this.roundResult);

        const totalRoundWin = calculateTotalWin(this.roundResult, userSettings.getBet());

        this.accumulatedWin += totalRoundWin;
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
    }
}
