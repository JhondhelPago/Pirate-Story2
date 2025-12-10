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
        // Notify UI
        this.match3.onSpinStart?.();

        // 1. Start the spin animation immediately (blur slides in + starts spinning)
        await this.match3.board.startSpin();

        // 2. Get backend result while blur is spinning
        const result = await this.match3.process.start();
        console.log("Backend result:", result);

        // 3. Give backend result to the board
        this.match3.board.applyBackendResults(result.reels, result.bonusReels);

        // 4. Finish the spin (blur slides out, real symbols slide in)
        await this.match3.board.finishSpin();

        return result;
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
