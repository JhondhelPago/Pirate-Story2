import { Match3 } from './Match3';

export class Match3Actions {
    public match3: Match3;
    public freeMoves = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public async actionSpin() {
        this.match3.useBaseProcess();
        this.match3.onSpinStart?.();
        await this.match3.process.start();
        this.match3.onProcessComplete?.();

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
        this.match3.useFreeSpinProcess();
        this.match3.freeSpinProcess.setSpins(spins);
        await this.match3.freeSpinProcess.freeSpinStart();
    }

    public setup(config: { isFreeSpin: boolean }) {
        this.freeMoves = config.isFreeSpin;
    }
}
