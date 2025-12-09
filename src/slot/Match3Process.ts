import { AsyncQueue } from "../utils/asyncUtils";
import { Match3 } from "./Match3";
import {
    slotGetClusters,
    slotEvaluateClusterWins,
} from "./SlotUtility";

export class Match3Process {
    private match3: Match3;
    private processing = false;
    private round = 0;
    private queue: AsyncQueue;

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();
    }

    public isProcessing() {
        return this.processing;
    }

    public getProcessRound() {
        return this.round;
    }

    public reset() {
        this.processing = false;
        this.round = 0;
        this.queue.clear();
    }

    public pause() {
        this.queue.pause();
    }

    public resume() {
        this.queue.resume();
    }

    // ---------------------------------------------------------
    // ENTRY POINT
    // ---------------------------------------------------------
    public async start() {
        if (this.processing) return;
        this.processing = true;
        this.round = 0;

        this.match3.onProcessStart?.();
        this.runProcessRound();
    }

    // ---------------------------------------------------------
    // STOP
    // ---------------------------------------------------------
    private async stop() {
        this.processing = false;
        this.queue.clear();

        const finalGrid = this.match3.board.grid;
        const finalMultiplierGrid = this.match3.board.multiplierGrid;

        const result = slotEvaluateClusterWins(finalGrid, finalMultiplierGrid);

        this.match3.onProcessComplete?.();
    }

    // ---------------------------------------------------------
    // MAIN ROUND SEQUENCE
    // ---------------------------------------------------------
    private async runProcessRound() {
        this.queue.add(async () => {
            this.round++;
            this.updateStats();
        });

        // Step 1 — clear matches
        this.queue.add(async () => {
            await this.processMatches();
        });

        // Step 4 — checkpoint
        this.queue.add(async () => {
            this.processCheckpoint();
        });
    }

    // ---------------------------------------------------------
    // LOGIC STEPS
    // ---------------------------------------------------------
    private updateStats() {
        const clusters = slotGetClusters(this.match3.board.grid);
        if (!clusters.length) return;

    }

    private async processMatches() {
        const clusters = slotGetClusters(this.match3.board.grid);
        if (!clusters.length) return;

        const popPromises = [];

        for (const cl of clusters) {
            popPromises.push(this.match3.board.popPieces(cl.positions));
        }

        await Promise.all(popPromises);
    }

    private processCheckpoint() {
        const clusters = slotGetClusters(this.match3.board.grid);

        const emptyCells = this.match3.board.grid
            .map(col => col.filter(t => t === 0).length)
            .reduce((a, b) => a + b, 0);

        if (clusters.length > 0 || emptyCells > 0) {
            this.runProcessRound();
        } else {
            this.stop();
        }
    }
}
