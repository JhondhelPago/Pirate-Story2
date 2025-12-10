import { Match3 } from './Match3';

export class Match3Actions {
    public match3: Match3;
    public freeMoves = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }


    // Action for the normal Spin Round using the Match3Process
    /** Standard SPIN */
    public async actionSpin() {
        this.match3.onSpinStart?.();
        console.log("Spin triggered on the block od the Match3Action actionSpin.");
        await this.match3.board.startClassicSpin();
        this.match3.board.stopClassicSpin();
        console.log('spinng state from the Match3Board: ', this.match3.board.spinning);
     
    }


    // Action for the Free Spin Round using the Match3FreeSpinProcess
    /** FREE SPIN */
    public async actionFreeSpin(spins: number) {
        // await this.match3.freeSpinProcess.start(5);
        await this.match3.freeSpinProcess.start(spins);
    }

    public setup(config: { isFreeSpin: boolean }) {
        this.freeMoves = config.isFreeSpin;
    }
}
