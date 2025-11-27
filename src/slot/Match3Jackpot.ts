import { Match3 } from './Match3';
import { Match3Position, slotGetJackpotMatches } from './SlotUtility';
import { SlotSymbol } from './SlotSymbol';
import { Jackpot } from './Match3Config';
import { waitFor } from '../utils/asyncUtils';

/**
 * Controls the special pieces in the game. Each special piece should have its own
 * special handler that will figure out match patterns (process) that will cause them to spawn
 * and release its power (trigger) when touched or popped out.
 */
export class Match3Jackpot {
    public processing: boolean = false;
    /** The Match3 instance */
    public match3: Match3;
    /** Jackpot record */
    public jackpots: Record<string, { type: number; active: number }> = {};
    /** Jackpot record */
    public winJackpots: Record<string, { type: number; active: number }> = {};
    /** Config Jackpots */
    private configJackpots: Jackpot[];

    constructor(match3: Match3) {
        this.match3 = match3;
        this.configJackpots = [];
    }

    public setup(jackpotConfig: Jackpot[]) {
        this.configJackpots = jackpotConfig;
    }

    /** Remove all specials handlers */
    public reset() {
        this.jackpots = {};
        this.processing = false;
    }

    public async process() {
        this.jackpots = {};
        this.winJackpots = {};

        const matches = slotGetJackpotMatches(this.match3.board.grid);
        const piecesByType: Record<number, SlotSymbol[]> = {};

        // Collect all pieces by type
        for (const match of matches) {
            for (const position of match) {
                const piece = this.match3.board.getPieceByPosition(position);
                if (piece) {
                    (piecesByType[piece.type] ??= []).push(piece);

                    this.jackpots[piece.type] = {
                        type: piece.type,
                        active: (this.jackpots[piece.type]?.active || 0) + 1,
                    };
                }
            }
        }

        // winPieces are grouped per jackpot symbol
        const winPieces: SlotSymbol[][] = [];
        const nonWinPieces: SlotSymbol[] = [];

        for (const configJackpot of this.configJackpots) {
            const piecesOfType = piecesByType[configJackpot.type] || [];
            if (piecesOfType.length >= configJackpot.requiredSymbols) {
                winPieces.push(piecesOfType);
            } else if (piecesOfType.length > 0) {
                nonWinPieces.push(...piecesOfType);
            }
        }

        // Sort by piece count, descending (most pieces first)
        winPieces.sort((a, b) => b.length - a.length);

        // Process winning groups one at a time
        for (const symbols of winPieces) {
            const positions: Match3Position[] = symbols.map((symbol) => ({ row: symbol.row, column: symbol.column }));
            await this.match3.board.playPieces(positions);
            await this.match3.onJackpotMatch?.({
                symbols,
            });
        }

        // Animate non-winning pieces all at once
        if (nonWinPieces.length > 0) {
            const positions: Match3Position[] = nonWinPieces.map((symbol) => ({
                row: symbol.row,
                column: symbol.column,
            }));
            await this.match3.board.playPieces(positions);
            await this.match3.onJackpotMatch?.({
                symbols: nonWinPieces,
            });
        }

        await this.displayJackpotWins();
    }

    private async displayJackpotWins() {
        console.log(this.jackpots, this.configJackpots);
        const jackpotWinsByType: Record<string, { times: number; jackpot: Jackpot }> = {};

        for (const [type, jackpotData] of Object.entries(this.jackpots)) {
            const configJackpot = this.configJackpots.find((config) => config.type === Number(type));

            if (configJackpot && jackpotData.active >= configJackpot.requiredSymbols) {
                const times = Math.floor(jackpotData.active / configJackpot.requiredSymbols);

                if (times > 0) {
                    jackpotWinsByType[type] = {
                        times,
                        jackpot: configJackpot,
                    };
                }
            }
        }

        // Display modals for each winning jackpot
        for (const [_, jackpotWin] of Object.entries(jackpotWinsByType)) {
            await waitFor(0.5);
            await this.match3.onJackpotTrigger?.({
                jackpot: jackpotWin.jackpot,
                times: jackpotWin.times,
            });
        }
    }
}
