import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import { calculateTotalWin, gridZeroReset, slotEvaluateClusterWins } from "./SlotUtility";

export class Match3FreeSpinProcess extends Match3Process {
    constructor(match3: Match3) {
        super(match3);
    }

    // state flag for this continuous process
    protected freeSpinProcessing = false;
    private accumulatedWin = 0;
    private remainingSpins = 0;
    private currentSpin = 0;

    private reelsTraversed = gridZeroReset();
    private multiplierTraversed = gridZeroReset();

    public async freeSpinStartInitialBonus() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const spinMode = userSettings.getSpinMode();
        const { minSpinMs } = this.getSpinModeDelays();

        console.log("intial bonus spin trigger from free spin process");

        await this.match3.board.startSpin();

        // Fetch backend + dynamic delay (ticker-driven)
        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        // Only wait the delay if we actually configured one
        if (minSpinMs > 0) {
            await delayPromise;
        }

        // If the whole process was stopped/cancelled during wait, bail cleanly
        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        this.reels = result.reels;
        this.multiplierReels = result.multiplierReels;
        this.bonusReels = result.bonusReels;
        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runInitialBonusProcess();

        // check the bonus symbol in the reels
        this.checkBonus(this.reels);

        await this.match3.board.finishSpin();

        this.processing = false;

        // Free-spin initial bonus spin specific callback
        await this.match3.onFreeSpinInitialBonusScatterComplete?.();
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
        // set the continuous process flag
        this.freeSpinProcessing = true;

        if (!this.processCheckpoint()) {
            // End of free-spin session
            this.freeSpinProcessing = false;

            this.match3.onFreeSpinComplete?.(
                this.currentSpin,
                this.remainingSpins
            );

            this.reset();
            return; // free spin end session
        }

        // One round of free spin
        await this.start();
        // pause between free spins based on spinMode + win/no win
        await this.delayBetweenSpins();
        // continue if spins remain
        await this.freeSpinStart();
    }

    /**
     * Free spin start logic, mirroring Match3Process.start()
     * but using merged reels for continuous free spins.
     */
    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        const spinMode = userSettings.getSpinMode();
        const { minSpinMs } = this.getSpinModeDelays();

        console.log(
            "From Match3FreeSpinProcess, SpinMode:",
            spinMode,
            "minSpinMs:",
            minSpinMs
        );

        // Notify free-spin round start (for UI)
        this.match3.onFreeSpinRoundStart?.(
            this.currentSpin,
            this.remainingSpins
        );

        await this.match3.board.startSpin();

        // Fetch backend + dynamic delay (ticker-driven)
        const backendPromise = this.fetchBackendSpin();
        const delayPromise =
            minSpinMs > 0 ? this.createCancelableDelay(minSpinMs, token) : Promise.resolve();

        const result = await backendPromise;

        // Only wait the delay if we actually configured one
        if (minSpinMs > 0) {
            await delayPromise;
        }

        // If the whole process was stopped/cancelled during wait, bail cleanly
        if (!this.processing || token.cancelled) {
            this.processing = false;
            return;
        }

        // Merge incoming reels/multipliers with existing ones (continuous/free-spin behavior)
        const reelsTraversed = this.mergeReels(this.reelsTraversed, result.reels);
        this.reelsTraversed = reelsTraversed;

        const multiplierTraversed = this.mergeMultipliers(this.multiplierTraversed, result.multiplierReels);
        this.multiplierTraversed = multiplierTraversed;

        this.match3.board.applyBackendResults(result.reels, result.multiplierReels);

        await this.runProcessRound();
        await this.match3.board.finishSpin();

        this.processing = false;

        // Free-spin specific callback
        await this.match3.onFreeSpinRoundComplete?.();
    }

    public getBonusReels() {
        return this.bonusReels;
    }


    public runInitialBonusProcess() {
        this.queue.add(async () => this.checkBonus(this.bonusReels));
    }

    public runProcessRound(): void {
        this.round++;
    
        this.queue.add(async () => {this.bonusReels = gridZeroReset()});

        this.queue.add(async () =>
            this.setMergeStickyWilds(
                this.match3.board.getWildReels(),
                this.match3.board.getBackendReels()
            )
        );
        // check the bonus reels -> then process to add spins if its pass the game condition for the bonus
        
        this.queue.add(async () => this.setRoundResult());
        this.queue.add(async () => this.setRoundWin());
        this.queue.add(async () => this.addRoundWin());
        this.queue.add(async () => this.setWinningPositions());
    }

    protected setRoundResult() {
        const reels = this.reelsTraversed;
        const multipliers = this.multiplierTraversed;
        // merge with the wild reels
        this.roundResult = slotEvaluateClusterWins(reels, multipliers);
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

    // isFreeSpinProcessing getter method here
    public getFreeSpinProcessing() {
        return this.freeSpinProcessing;
    }

    public reset() {
        this.wildReels = gridZeroReset();
        this.match3.board.setWildReels(this.wildReels);

        // board cleaning specific for the free spin process
        this.match3.board.clearWildLayerAndMultipliers();
        this.match3.board.rebuildReelsAndAnimatePositions(this.reelsTraversed, this.multiplierTraversed, this.winningPositions!)

        this.reelsTraversed = gridZeroReset();
        this.multiplierTraversed = gridZeroReset();

        this.currentSpin = 0;
        this.remainingSpins = 0;
        this.accumulatedWin = 0;
    }
}
