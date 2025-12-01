import { BetAPI } from '../api/betApi';
import { AsyncQueue, waitFor } from '../utils/asyncUtils';
import { gameConfig } from '../utils/gameConfig';
import { Match3 } from './Match3';
import {
    match3GetEmptyPositions,
    match3ApplyGravity,
    match3FillUp,
    match3GetPieceType,
    match3GridToString,
    slotGetMatches,
    slotGetScatterMatches,
} from './SlotUtility';

/**
 * Simplified Match3Process:
 * - No match checking
 * - No pop
 * - No gravity
 * - No refill logic
 * - Every spin replaces the entire 5x5 grid with new data
 * - Ensures ONLY ONE grid update per spin (no double-rendering)
 */
export class Match3Process {
    private match3: Match3;
    private processing = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public isProcessing() {
        return this.processing;
    }

    public pause() {}
    public resume() {}
    public reset() {
        this.processing = false;
    }

    /** ENTRY POINT FOR EVERY SPIN */
    public async start() {
        if (this.processing) {
            console.warn("🚨 Match3Process.start() BLOCKED — already processing!");
            return;
        }

        console.log("🟢 Match3Process.start() CALLED");

        this.processing = true;

        await this.buildSingleGrid();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    /**
     * FULL clean 5×5 rebuild
     * No popping, no gravity, no refill, no multiple rounds.
     * ONE and ONLY ONE grid update per spin.
     */
    private async buildSingleGrid() {
        console.log("🟦 buildSingleGrid() — BUILDING NEW 5×5 GRID");
        
        const result = await BetAPI.spin('n');

        // Server ALREADY sends row-major (row → col)
        const reels = result.reels;
        const bonus = result.bonusReels;

        // Update internal grid (row-major)
        this.match3.board.grid = reels;

        // Remove old symbols
        for (const piece of this.match3.board.pieces) {
            piece.destroy();
        }
        this.match3.board.pieces = [];

        const fallAnims: Promise<void>[] = [];
        const height = this.match3.board.getHeight();

        // CREATE NEW 5×5 GRID (row-major)
        for (let row = 0; row < this.match3.board.rows; row++) {
            for (let col = 0; col < this.match3.board.columns; col++) {

                const position = { row, column: col };

                const type = reels[row][col];
                const multiplier = bonus[row][col];

                const piece = this.match3.board.createPiece(position, type, multiplier);

                const targetX = piece.x;
                const targetY = piece.y;

                // Start above board for the "fall" animation
                piece.y = -height;

                fallAnims.push(piece.animateFall(targetX, targetY));
            }
        }

        await Promise.all(fallAnims);
    }

    public async stop() {
        this.processing = false;
    }
}
