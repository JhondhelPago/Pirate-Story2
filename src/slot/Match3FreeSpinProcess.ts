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
        if(!this.processCheckpoint()) return;
        
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
        console.log("block to add the round win to accumucated Win:")
        console.log(this.roundResult);
        this.accumulatedWin += win;
    }

    public setSpins(spins: number){
        this.remainingSpins = spins;
    }

    private delay(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }




}
