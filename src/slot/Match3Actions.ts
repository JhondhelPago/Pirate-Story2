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
        // Fire callback
        this.match3.onSpinStart?.();

        // Do NOT reset the board here — animation needs current pieces
        // Do NOT call fallToBottomGrid — it no longer exists

        // Run the spin animation process
        await this.match3.process.start();

        // After process finishes, Process.start() will call onProcessComplete automatically
    }


    // Action for the Free Spin Round using the Match3FreeSpinProcess
    /** FREE SPIN */
    public async actionFreeSpin() {
        // await this.match3.freeSpinProcess.start(5);
        await this.match3.freeSpinProcess.start(10);
    }

    public setup(config: { isFreeSpin: boolean }) {
        this.freeMoves = config.isFreeSpin;
    }
}
