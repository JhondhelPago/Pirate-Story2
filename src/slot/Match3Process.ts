import { BetAPI } from "../api/betApi";
import { Match3 } from "./Match3";

export interface BackendSpinResult {
    reels: number[][];
    bonusReels: number[][];
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    // Cancel token for interrupting the minimum delay
    private cancelToken: { cancelled: boolean } | null = null;

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
    // PUBLIC METHOD — INTERRUPT MINIMUM DELAY
    // ---------------------------------------------------------
    public interruptSpinDelay() {
        if (this.cancelToken) {
            this.cancelToken.cancelled = true;
        }
    }

    // ---------------------------------------------------------
    // ENTRY POINT — SPIN PROCESS WITH MINIMUM DELAY
    // ---------------------------------------------------------
    public async start() {
        if (this.processing) {
            return;
        }

        this.processing = true;
        this.match3.onProcessStart?.();

        // Setup cancel token for this spin
        const token = { cancelled: false };
        this.cancelToken = token;

        // Start spinning animation immediately
        await this.match3.board.startSpin();

        // Start the backend request
        const backendPromise = this.fetchBackendSpin();

        // Start the cancelable minimum delay (1s)
        const delayPromise = this.createCancelableDelay(1000, token);

        // Wait for backend result (always required)
        const result = await backendPromise;

        // Wait for minimum delay or skip if cancelled
        await delayPromise;

        // IMPORTANT FIX:
        // Do NOT return early when cancelled
        // Skipping delay is fine — continue the spin normally.

        // Apply backend result (even if delay was skipped)
        this.match3.board.applyBackendResults(result.reels, result.bonusReels);

        // Finish spin animation normally
        await this.match3.board.finishSpin();

        this.processing = false;
    }

    // ---------------------------------------------------------
    // CANCELABLE DELAY (does NOT break the spin)
    // ---------------------------------------------------------
    private createCancelableDelay(ms: number, token: { cancelled: boolean }): Promise<void> {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                resolve(); // delay finished normally
            }, ms);

            // If delay is cancelled early → skip the wait
            const check = setInterval(() => {
                if (token.cancelled) {
                    clearTimeout(timer);
                    clearInterval(check);
                    resolve(); // resolve immediately
                }
            }, 10);
        });
    }

    // ---------------------------------------------------------
    // BACKEND REQUEST
    // ---------------------------------------------------------
    private async fetchBackendSpin(): Promise<BackendSpinResult> {
        return BetAPI.spin("n");
    }
}
