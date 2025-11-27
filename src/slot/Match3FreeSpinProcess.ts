import { BetAPI } from '../api/betApi';
import { AsyncQueue, waitFor } from '../utils/asyncUtils';
import { Match3 } from './Match3';
import {
    match3GetEmptyPositions,
    match3ApplyGravity,
    match3FillUp,
    match3GetPieceType,
    match3GridToString,
    slotGetMatches,
    Match3Position,
    slotGetJackpotMatches,
} from './SlotUtility';
import { SlotSymbol } from './SlotSymbol';

/**
 * Handles the free spin gameplay progression on the board. Similar to Match3Process,
 * but specifically designed for free spin rounds with additional tracking and logic.
 * The process continues until there are no new matches or empty spaces left in the grid.
 *
 * The process round steps are sequenced in a queue of async functions to keep things simple,
 * allowing each step to be awaited/delayed as needed for optimal game flow.
 */
export class Match3FreeSpinProcess {
    /** The Match3 instance */
    private match3: Match3;
    /** Tells if it is currently processing or not */
    private processing = false;
    /** The current processing round number, resets when a new process starts */
    private round = 0;
    /** Flag indicating if the current round resulted in a win */
    private hasRoundWin = false;
    /** Number of remaining free spins */
    private remainingFreeSpins = 0;
    /** Current free spin number being played */
    private currentFreeSpin = 0;
    /** The list of queued actions that the grid processing will take */
    private queue: AsyncQueue;

    constructor(match3: Match3) {
        this.match3 = match3;
        this.queue = new AsyncQueue();
    }

    /** Check if is processing */
    public isProcessing() {
        return this.processing;
    }

    /** Get current process round */
    public getProcessRound() {
        return this.round;
    }

    /** Get remaining free spins */
    public getRemainingFreeSpins() {
        return this.remainingFreeSpins;
    }

    /** Get current free spin number */
    public getCurrentFreeSpin() {
        return this.currentFreeSpin;
    }

    /** Interrupt processing and cleanup process queue */
    public reset() {
        this.processing = false;
        this.round = 0;
        this.remainingFreeSpins = 0;
        this.currentFreeSpin = 0;
        this.queue.clear();
    }

    /** Pause processing */
    public pause() {
        this.queue.pause();
    }

    /** Resume processing */
    public resume() {
        this.queue.resume();
    }

    /** Start processing free spins with the specified number of spins */
    public async start(freeSpinCount: number) {
        if (this.processing) return;
        this.processing = true;

        // STOP normal process
        this.match3.process.stop();

        this.round = 0;
        this.remainingFreeSpins = freeSpinCount;
        this.currentFreeSpin = 0;

        this.match3.onFreeSpinStart?.(freeSpinCount);

        console.log('[Match3] ======= FREE SPIN PROCESSING START ==========');
        console.log('[Match3] Total free spins:', freeSpinCount);

        this.runNextFreeSpin();
    }

    /** Clear process query and stop processing free spins */
    public async stop() {
        if (!this.processing) return;
        this.processing = false;
        this.queue.clear();
        console.log('[Match3] FREE SPIN rounds:', this.round);
        console.log('[Match3] FREE SPIN Board pieces:', this.match3.board.pieces.length);
        console.log('[Match3] FREE SPIN Grid:\n' + match3GridToString(this.match3.board.grid));
        console.log('[Match3] ======= FREE SPIN PROCESSING COMPLETE =======');
        this.match3.onFreeSpinComplete?.();
    }

    /** Start the next free spin round */
    private async runNextFreeSpin() {
        if (this.remainingFreeSpins <= 0) {
            await waitFor(1);
            this.stop();
            return;
        }

        await waitFor(1);

        this.currentFreeSpin += 1;
        this.remainingFreeSpins -= 1;

        console.log(`[Match3] ======= FREE SPIN #${this.currentFreeSpin} START ==========`);
        this.match3.onFreeSpinRoundStart?.(this.currentFreeSpin, this.remainingFreeSpins);

        // Queue the free spin grid fill
        await this.match3.board.fallToBottomGrid();
        this.match3.board.reset();

        this.queue.add(async () => {
            await this.fillFreeSpinGrid();
        });

        // Start processing this free spin round
        this.runProcessRound();
    }

    /** Fill the grid for a free spin round */
    public async fillFreeSpinGrid() {
        const result = await BetAPI.spin('n');
        this.match3.board.grid = result.reels;

        // Get all positions from the grid
        const positions: Match3Position[] = [];
        for (let col = 0; col < this.match3.board.columns; col++) {
            for (let row = 0; row < this.match3.board.rows; row++) {
                if (this.match3.board.grid[col][row] !== 0) {
                    positions.push({ row, column: col });
                }
            }
        }

        // Group pieces by column
        const piecesByColumn: Record<number, Array<{ piece: SlotSymbol; x: number; y: number }>> = {};
        const piecesPerColumn: Record<number, number> = {};

        for (const position of positions) {
            const pieceType = match3GetPieceType(this.match3.board.grid, position);
            const piece = this.match3.board.createPiece(position, pieceType);

            // Count pieces per column so new pieces can be stacked up accordingly
            if (!piecesPerColumn[piece.column]) {
                piecesPerColumn[piece.column] = 0;
                piecesByColumn[piece.column] = [];
            }
            piecesPerColumn[piece.column] += 1;

            const x = piece.x;
            const y = piece.y;
            const columnCount = piecesPerColumn[piece.column];
            const height = this.match3.board.getHeight();
            piece.y = -height * 0.5 - columnCount * this.match3.config.tileSize;

            piecesByColumn[piece.column].push({ piece, x, y });
        }

        // Animate each column with a small delay between them
        const animPromises: Promise<void>[] = [];

        for (const column in piecesByColumn) {
            const columnPieces = piecesByColumn[column];

            // Start all animations in this column
            for (const { piece, x, y } of columnPieces) {
                animPromises.push(piece.animateFall(x, y));
            }

            // Wait before starting next column
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Wait for all animations to complete
        await Promise.all(animPromises);
    }

    /**
     * Sequence of logical steps to evolve the board during free spins, added to the async queue.
     * Each step can be awaited/delayed as needed to create a nice gameplay progress flow.
     */
    private async runProcessRound() {
        // Step #1 - Bump sequence number and update stats with new matches found
        this.queue.add(async () => {
            this.round += 1;
            console.log(`[Match3] -- FREE SPIN SEQUENCE ROUND #${this.round} START`);
            this.updateStats();
        });

        // Step #2 - Process and clear remaining common matches
        this.queue.add(async () => {
            await this.processRegularMatches();
        });

        // Step #3 - Move down remaining pieces in the grid if there are empty spaces in their columns
        this.queue.add(async () => {
            await this.applyGravity();
        });

        // Step #4 - Process special matches
        this.queue.add(async () => {
            await this.processJackpotMatches();
        });

        // Step #5 - Create new pieces that falls from the top to fill up remaining empty spaces
        this.queue.add(async () => {
            await this.refillGrid();
        });

        // Step #6 - Finish up this sequence round and check if it needs a re-run, otherwise move to next free spin
        this.queue.add(async () => {
            console.log(`[Match3] -- FREE SPIN SEQUENCE ROUND #${this.round} FINISH`);
            this.processCheckpoint();
        });
    }

    /** Update gameplay stats with new matches found in the grid */
    private async updateStats() {
        const matches = slotGetMatches(this.match3.board.grid);
        if (!matches.length) return;
        console.log('[Match3] Update free spin stats');
    }

    /** Clear all matches in the grid */
    private async processRegularMatches() {
        console.log('[Match3] Process regular matches (free spin)');
        const matches = slotGetMatches(this.match3.board.grid);

        if (matches.length > 0) {
            this.hasRoundWin = true;
        }

        const animePlayPieces = [];
        for (const match of matches) {
            animePlayPieces.push(this.match3.board.playPieces(match));
        }

        await Promise.all(animePlayPieces);

        const animPopPromises = [];
        for (const match of matches) {
            animPopPromises.push(this.match3.board.popPieces(match));
        }

        await Promise.all(animPopPromises);
    }

    /** Process special matches in the grid */
    private async processJackpotMatches() {
        if (!this.hasRoundWin) return;
        this.hasRoundWin = false;
        const matches = slotGetJackpotMatches(this.match3.board.grid);

        const animePlayPieces = [];
        for (const match of matches) {
            animePlayPieces.push(this.match3.board.playPieces(match));
        }

        await Promise.all(animePlayPieces);
    }

    /** Make existing pieces fall in the grid if there are empty spaces below them */
    private async applyGravity() {
        const changes = match3ApplyGravity(this.match3.board.grid);
        console.log('[Match3] Apply gravity (free spin) - moved pieces:', changes, changes.length);
        const animPromises = [];

        for (const change of changes) {
            const from = change[0];
            const to = change[1];
            const piece = this.match3.board.getPieceByPosition(from);
            if (!piece) continue;
            piece.row = to.row;
            piece.column = to.column;
            const newPosition = this.match3.board.getViewPositionByGridPosition(to);
            animPromises.push(piece.animateFall(newPosition.x, newPosition.y));
        }

        await Promise.all(animPromises);
    }

    /** Fill up empty spaces in the grid with new pieces falling from the top */
    private async refillGrid() {
        const result = await BetAPI.spin('r');
        const newPieces = match3FillUp(this.match3.board.grid, this.match3.board.commonTypes, result.reels);
        console.log('[Match3] Refill grid (free spin) - new pieces:', newPieces.length);

        const animPromises = [];
        const piecesPerColumn: Record<number, number> = {};

        for (const position of newPieces) {
            const pieceType = match3GetPieceType(this.match3.board.grid, position);
            const piece = this.match3.board.createPiece(position, pieceType);

            // Count pieces per column so new pieces can be stacked up accordingly
            if (!piecesPerColumn[piece.column]) piecesPerColumn[piece.column] = 0;
            piecesPerColumn[piece.column] += 1;

            const x = piece.x;
            const y = piece.y;
            const columnCount = piecesPerColumn[piece.column];
            const height = this.match3.board.getHeight();
            piece.y = -height * 0.5 - columnCount * this.match3.config.tileSize;
            animPromises.push(piece.animateFall(x, y));
        }

        await Promise.all(animPromises);
    }

    /** Check the grid if there are empty spaces and/or matches remaining, and run another process round if needed */
    private async processCheckpoint() {
        // Check if there are any remaining matches or empty spots
        const newMatches = slotGetMatches(this.match3.board.grid);
        const emptySpaces = match3GetEmptyPositions(this.match3.board.grid);
        console.log('[Match3] Checkpoint (free spin) - New matches:', newMatches.length);
        console.log('[Match3] Checkpoint (free spin) - Empty spaces:', emptySpaces.length);

        if (newMatches.length || emptySpaces.length) {
            console.log('[Match3] Checkpoint - Another sequence run is needed');
            // Run it again if there are any new matches or empty spaces in the grid
            this.runProcessRound();
        } else {
            // Free spin round complete, notify and move to next free spin
            console.log(`[Match3] ======= FREE SPIN #${this.currentFreeSpin} COMPLETE ==========`);
            this.match3.onFreeSpinRoundComplete?.(this.currentFreeSpin, this.remainingFreeSpins);
            this.round = 0; // Reset round counter for next free spin
            this.runNextFreeSpin();
        }
    }
}
