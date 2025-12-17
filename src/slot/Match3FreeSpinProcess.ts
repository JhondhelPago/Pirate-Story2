import { userSettings } from "../utils/userSettings";
import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";

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
            this.match3.onFreeSpinRoundComplete?.(this.currentSpin, this.remainingSpins);
            return; // free spin end session
        }
            
        
        await this.start();
        await this.delay(1000); 
        await this.freeSpinStart();
    }

    public runProcessRound(): void {
        this.round++;

        this.queue.add( async () => this.setRoundResult());
        this.queue.add( async () => this.addRoundWin(100));
        this.queue.add( async () => this.setWinningPositions());
        this.queue.add( async () => this.setMergeStickyWilds( this.match3.board.getWildReels(), this.match3.board.getBackendReels()));

    }

    public addRoundWin(win: number){
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

    private delay(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

}
