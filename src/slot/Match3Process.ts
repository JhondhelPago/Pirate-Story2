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
        if (this.processing) {
            return {
                reels: this.match3.board["backendReels"],
                bonusReels: this.match3.board["backendMultipliers"]
            };
        }

        this.processing = true;
        this.match3.onProcessStart?.();

        const result = await this.fetchBackendSpin();

        this.processing = false;

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
