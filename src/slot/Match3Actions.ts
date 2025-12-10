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

        await this.match3.board.startClassicSpin();

        const result = await this.match3.process.start();
        console.log('result: ', result);

        this.match3.board.applyFinalReels(result.reels);
        this.match3.board.applyFinalMultipliers(result.bonusReels);

        this.match3.board.stopClassicSpin();
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
