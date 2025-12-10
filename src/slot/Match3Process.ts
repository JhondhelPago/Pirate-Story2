import { BetAPI } from "../api/betApi";
import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";

export interface BackendSpinResult {
    reels: number[][];
    bonusReels: number[][];
}

export class Match3Process {
    private match3: Match3;
    private processing = false;

    private queue: AsyncQueue;

    private cancelToken: { cancelled: boolean } | null = null;

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();
    }

    public isProcessing() {
        return this.processing;
    }

    public reset() {
        this.processing = false;
    }
    public interruptSpinDelay() {
        if (this.cancelToken) {
            this.cancelToken.cancelled = true;
        }
    }

    public pause() {
        this.queue.pause();
    }

    public resume() {
        this.queue.resume();
    }

    public async start() {
        if (this.processing) {
            return;
        }

        this.processing = true;
        this.match3.onProcessStart?.();

        const token = { cancelled: false };
        this.cancelToken = token;

        await this.match3.board.startSpin();

        const backendPromise = this.fetchBackendSpin();

        const delayPromise = this.createCancelableDelay(1000, token);

        const result = await backendPromise;

        await delayPromise;

        this.match3.board.applyBackendResults(result.reels, result.bonusReels);

        await this.match3.board.finishSpin();

        this.processing = false;
    }

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
