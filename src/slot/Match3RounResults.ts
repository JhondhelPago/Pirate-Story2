import { Container, Graphics } from 'pixi.js';
import { pool } from '../utils/pool';
import { Match3 } from './Match3';
import { Match3Config, slotGetBlocks } from './Match3Config';
import {
    Match3Position,
    match3SetPieceType,
    match3GetPieceType,
    match3CreateGrid,
    match3ForEach,
    Match3Grid,
    Match3Type,
} from './SlotUtility';
import { SlotSymbol } from './SlotSymbol';
import { BetAPI } from '../api/betApi';

/**
 * Holds the grid state and control its visual representation, creating and removing pieces accordingly.
 * As a convention for this game, 'grid' is usually referring to the match3 state (array of types),
 * and 'board' is its visual representation with sprites.
 */
export class Match3RoundResults {
    /** The Match3 instance */
    public match3: Match3;
    /** The grid state, with only numbers */
    public grid: Match3Grid = [];
    /** All piece sprites currently being used in the grid */
    public pieces: SlotSymbol[] = [];
    /** Mask all pieces inside board dimensions */
    public piecesMask: Graphics;
    /** A container for the pieces sprites */
    public piecesContainer: Container;
    /** Number of rows in the boaard */
    public rows = 0;
    /** Number of columns in the boaard */
    public columns = 0;
    /** The size (width & height) of each board slot */
    public tileSize = 0;
    /** List of common types available for the game */
    public commonTypes: Match3Type[] = [];
    /** Map piece types to piece names */
    public typesMap!: Record<number, string>;

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesContainer = new Container();
        this.match3.addChild(this.piecesContainer);

        this.piecesMask = new Graphics().rect(-2, -2, 4, 4).fill({ color: 0xff0000, alpha: 0.5 });
        this.match3.addChild(this.piecesMask);
        this.piecesContainer.mask = this.piecesMask;
    }

    /**
     * Setup the initial grid state and fill up the view with pieces
     * @param config Match3 config params
     */
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;
        this.piecesMask.width = this.getWidth();
        this.piecesMask.height = this.getHeight();
        this.piecesContainer.visible = true;

        // The list of blocks (including specials) that will be used in the game
        const blocks = slotGetBlocks();

        this.typesMap = {};

        // Organise types and set up special handlers
        // Piece types will be defined according to their positions in the string array of blocks
        // Example: If 'piece-dragon' is the 2nd in the blocks list (blocks[1]), its type will be 2
        for (let i = 0; i < blocks.length; i++) {
            const name = blocks[i];
            const type = i + 1;
            this.commonTypes.push(type);
            this.typesMap[type] = name.symbol;
        }

        // Create the initial grid state
        this.grid = match3CreateGrid(this.rows, this.columns, this.commonTypes);

        // Fill up the visual board with piece sprites
        match3ForEach(this.grid, (gridPosition: Match3Position, type: Match3Type) => {
            this.createPiece(gridPosition, type);
        });
    }

    public async fallToBottomGrid() {
        // Group pieces by column
        const piecesByColumn: Record<number, Array<{ piece: any; x: number; y: number }>> = {};
        const piecesPerColumn: Record<number, number> = {};

        // Use existing pieces from the board
        for (const piece of this.match3.board.pieces) {
            // Count pieces per column so new pieces can be stacked up accordingly
            if (!piecesPerColumn[piece.column]) {
                piecesPerColumn[piece.column] = 0;
                piecesByColumn[piece.column] = [];
            }
            piecesPerColumn[piece.column] += 1;

            const x = piece.x;
            const columnCount = piecesPerColumn[piece.column];
            const height = this.match3.board.getHeight();
            const targetY = height * 0.5 + columnCount * this.match3.config.tileSize;

            piecesByColumn[piece.column].push({ piece, x, y: targetY });
        }

        const animPromises = [];

        // Animate each column with a small delay between them
        for (const column in piecesByColumn) {
            const columnPieces = piecesByColumn[column];
            for (const { piece, x, y } of columnPieces) {
                animPromises.push(piece.animateFall(x, y));
            }
            await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay, adjust as needed
        }

        await Promise.all(animPromises);
    }

    public async fillGrid() {
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
     * Dispose all pieces and clean up the board
     */
    public reset() {
        let i = this.pieces.length;
        while (i--) {
            const piece = this.pieces[i];
            this.disposePiece(piece);
        }
        this.pieces.length = 0;
    }

    /**
     * Clear all pieces by setting all it's value to 0
     */
    public clear() {
        for (let col = 0; col < this.columns; col++) {
            for (let row = 0; row < this.rows; row++) {
                this.grid[col][row] = 0;
            }
        }
    }

    public createPiece(position: Match3Position, pieceType: Match3Type) {
        const name = this.typesMap[pieceType];
        const piece = pool.get(SlotSymbol);
        const viewPosition = this.getViewPositionByGridPosition(position);

        piece.setup({
            name,
            type: pieceType,
            size: this.match3.config.tileSize,
            interactive: true,
        });
        piece.row = position.row;
        piece.column = position.column;

        // Position piece above the grid, accounting for pieces above it
        piece.x = viewPosition.x;
        piece.y = viewPosition.y;

        this.pieces.push(piece);
        this.piecesContainer.addChild(piece);
        return piece;
    }

    /**
     * Dispose a piece, remving it from the board
     * @param piece Piece to be removed
     */
    public disposePiece(piece: SlotSymbol) {
        if (this.pieces.includes(piece)) {
            this.pieces.splice(this.pieces.indexOf(piece), 1);
        }
        if (piece.parent) {
            piece.parent.removeChild(piece);
        }

        pool.giveBack(piece);
    }

    /**
     * Spawn a new piece in the board, removing the piece in the same place, if there are any
     * @param position The position where the piece should be spawned
     * @param pieceType The type of the piece to be spawned
     */
    public async spawnPiece(position: Match3Position, pieceType: Match3Type) {
        const oldPiece = this.getPieceByPosition(position);
        if (oldPiece) this.disposePiece(oldPiece);
        match3SetPieceType(this.grid, position, pieceType);
        if (!pieceType) return;
        const piece = this.createPiece(position, pieceType);
        await piece.animateSpawn();
    }

    /**
     * Pop a piece out of the board, triggering its effects if it is a special piece
     * @param position The grid position of the piece to be popped out
     * @param causedBySpecial If the pop was caused by special effect
     */
    public async playPiece(position: Match3Position) {
        const piece = this.getPieceByPosition(position);
        const type = match3GetPieceType(this.grid, position);
        if (!type || !piece) return;
        await piece.animatePlay();
    }

    /**
     * Pop a piece out of the board, triggering its effects if it is a special piece
     * @param position The grid position of the piece to be popped out
     * @param causedBySpecial If the pop was caused by special effect
     */
    public async playSpecialPiece(position: Match3Position) {
        const piece = this.getPieceByPosition(position);
        const type = match3GetPieceType(this.grid, position);
        if (!type || !piece) return;
        await piece.animateSpecialPlay();
    }

    /**
     * Pop a piece out of the board, triggering its effects if it is a special piece
     * @param position The grid position of the piece to be popped out
     * @param causedBySpecial If the pop was caused by special effect
     */
    public async popPiece(position: Match3Position) {
        const piece = this.getPieceByPosition(position);
        const type = match3GetPieceType(this.grid, position);
        if (!type || !piece) return;
        // Set piece position in the grid to 0 and pop it out of the board
        match3SetPieceType(this.grid, position, 0);

        if (this.pieces.includes(piece)) {
            this.pieces.splice(this.pieces.indexOf(piece), 1);
        }

        await piece.animatePop();
        this.disposePiece(piece);
    }

    /**
     * Pop a list of pieces all together
     * @param positions List of positions to be popped out
     * @param causedBySpecial If this was caused by special effects
     */
    public async playPieces(positions: Match3Position[]) {
        const animPromises = [];
        for (const position of positions) {
            animPromises.push(this.playPiece(position));
        }
        await Promise.all(animPromises);
    }

    /**
     * Pop a list of pieces all together
     * @param positions List of positions to be popped out
     * @param causedBySpecial If this was caused by special effects
     */
    public async playSpecialPieces(positions: Match3Position[]) {
        const animPromises = [];
        for (const position of positions) {
            animPromises.push(this.playSpecialPiece(position));
        }
        await Promise.all(animPromises);
    }

    /**
     * Pop a list of pieces all together
     * @param positions List of positions to be popped out
     * @param causedBySpecial If this was caused by special effects
     */
    public async popPieces(positions: Match3Position[]) {
        const animPromises = [];
        for (const position of positions) {
            animPromises.push(this.popPiece(position));
        }
        await Promise.all(animPromises);
    }

    /**
     * Find a piece sprite by grid position
     * @param position The grid position to look for
     * @returns
     */
    public getPieceByPosition(position: Match3Position) {
        for (const piece of this.pieces) {
            if (piece.row === position.row && piece.column === position.column) {
                return piece;
            }
        }
        return null;
    }

    /**
     * Conver grid position (row & column) to view position (x & y)
     * @param position The grid position to be converted
     * @returns The equivalet x & y position in the board
     */
    public getViewPositionByGridPosition(position: Match3Position) {
        const offsetX = ((this.columns - 1) * this.tileSize) / 2;
        const offsetY = ((this.rows - 1) * this.tileSize) / 2;
        const x = position.column * this.tileSize - offsetX;
        const y = position.row * this.tileSize - offsetY;
        return { x, y };
    }

    /**
     * Find out the piece type in a grid position
     * @param position
     * @returns The type of the piece
     */
    public getTypeByPosition(position: Match3Position) {
        return match3GetPieceType(this.grid, position);
    }

    /** Get the visual width of the board */
    public getWidth() {
        return this.tileSize * this.columns;
    }

    /** Get the visual height of the board */
    public getHeight() {
        return this.tileSize * this.rows;
    }

    /** Pause all pieces animations */
    public pause() {
        for (const piece of this.pieces) piece.pause();
    }

    /** Resule all pieces animations */
    public resume() {
        for (const piece of this.pieces) piece.resume();
    }

    /** Bring a piece in front of all others */
    public bringToFront(piece: SlotSymbol) {
        this.piecesContainer.addChild(piece);
    }
}
