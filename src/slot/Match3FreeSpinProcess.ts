import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import { gridZeroReset } from "./SlotUtility";

export class Match3FreeSpinProcess extends Match3Process{
    constructor(match3: Match3) {
        super(match3);
    }
    
    private accumulatedWin = 0;
    private remainingSpins = 0;
    private currentSpin = 0;

    public processCheckpoint() {
        // check if there is any spin left, then run the process
        if(this.remainingSpins > 0){
            this.remainingSpins--;
            this.currentSpin++;

            return true;
        }

        return false;
    }

    public async freeSpinStart(){

        if(!this.processCheckpoint()){
            this.reset();
            return; // free spin end session
        };
            
        
        await this.start();
        await this.delay(); 
        await this.freeSpinStart();
    }

    public async start() {
        if (this.processing) return;
        this.processing = true;

        const token = { cancelled: false };
        this.cancelToken = token;

        this.match3.onFreeSpinRoundStart?.(this.currentSpin, this.remainingSpins);

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
        
        await this.runProcessRound();
        await this.match3.board.finishSpin();

        this.processing = false;
        await this.match3.onProcessComplete?.();
    }

    public runProcessRound(): void {
        this.round++;

        this.queue.add( async () => this.setRoundResult());
        this.queue.add( async () => this.setRoundWin());
        this.queue.add( async () => this.addRoundWin());
        this.queue.add( async () => this.setWinningPositions());
        this.queue.add( async () => this.setMergeStickyWilds( this.match3.board.getWildReels(), this.match3.board.getBackendReels()));

    }

    public addRoundWin(){
        console.log("Remaining Spins: ",  this.remainingSpins);
        console.log(this.roundResult);

        const totalRoundMultiplier = this.roundResult.reduce(
            (sum, result) => sum + result.multiplier, 0
        );
        console.log("this total round multiplier: ", totalRoundMultiplier);
        const totalRoundWin = totalRoundMultiplier * userSettings.getBet();
        console.log("this total round win: ", totalRoundWin);
        this.accumulatedWin += totalRoundWin;
    }

    public setSpins(spins: number){
        this.remainingSpins = spins;
    }

    public getAccumulatedWin() {
        return this.accumulatedWin;
    }

    private delay() {
        const ms = this.roundResult.length > 0 ? 2000 : 1000;

        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    public reset(){
        this.match3.onFreeSpinRoundComplete?.(this.currentSpin, this.remainingSpins);
        this.wildReels = gridZeroReset();
        this.match3.board.setWildReels(this.wildReels);
        this.match3.board.clearWildLayerAndMultipliers();

        this.currentSpin = 0;
        this.remainingSpins = 0;
        this.accumulatedWin = 0; 
    }

}
