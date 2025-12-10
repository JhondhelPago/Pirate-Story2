import { Match3 } from './Match3';

export class Match3Actions {
    public match3: Match3;
    public freeMoves = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public async actionSpin() {
        this.match3.onSpinStart?.();

        this.match3.process.start();

        //Simulate user interrupt after 500ms
        // setTimeout(() => {
        //     console.log("Interrupting delay...");
        //     this.match3.process.interruptSpinDelay();
        // }, 10);
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
