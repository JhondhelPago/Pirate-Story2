import { Match3 } from "./Match3";

export interface BackendSpinResult {
    reels: number[][];
    bonusReels: number[][];
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public isProcessing() {
        return this.processing;
    }

    public reset() {
        this.processing = false;
    }

    // ---------------------------------------------------------
    // ENTRY POINT — FETCH BACKEND + SEND TO BOARD
    // ---------------------------------------------------------
    public async start(): Promise<BackendSpinResult> {
        // Prevent double-processing
        if (this.processing) {
            return {
                reels: this.match3.board.grid,
                bonusReels: this.match3.board.multiplierGrid
            };
        }

        this.processing = true;
        this.match3.onProcessStart?.();

        // 1. Fetch backend result
        const result = await this.fetchBackendSpin();

        // 2. Update board's backend data
        this.match3.board.setBackendGrids(result.reels, result.bonusReels);

        // 3. Mark process complete
        this.processing = false;

        // 4. Return backend result to Match3Actions
        return result;
    }

    // ---------------------------------------------------------
    // FETCH BACKEND SPIN
    // ---------------------------------------------------------
    private async fetchBackendSpin(): Promise<BackendSpinResult> {
        const res = await fetch("http://localhost:3000/spin");
        return res.json();
    }

    
    
}
