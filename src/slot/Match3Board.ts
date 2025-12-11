import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { pool } from "../utils/pool";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import {
    Match3Position,
    match3SetPieceType,
    match3GetPieceType,
    match3CreateGrid,
    match3ForEach,
    Match3Grid,
    Match3Type,
    getRandomMultiplier
} from "./SlotUtility";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
}

export class Match3Board {
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
    /** Number of rows in the board */
    public rows = 0;
    /** Number of columns in the board */
    public columns = 0;
    /** The size (width & height) of each board slot */
    public tileSize = 0;
    /** List of common types available for the game */
    public commonTypes: Match3Type[] = [];
    /** Map piece types to piece names */
    public typesMap!: Record<number, string>;

    // --- SPIN STATE -------------------------------------------------
    public spinning = false;
    private spinTicker: Ticker;
    /** Visual speed of the spin in "tiles per second" */
    private spinTilesPerSecond = 12;

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesContainer = new Container();
        this.match3.addChild(this.piecesContainer);

        this.piecesMask = new Graphics().rect(-2, -2, 4, 4).fill({ color: 0xff0000, alpha: 0.5 });
        this.match3.addChild(this.piecesMask);
        this.piecesContainer.mask = this.piecesMask;

        // Spin ticker (separate from app.ticker for control)
        this.spinTicker = new Ticker();
        this.spinTicker.add(this.onSpinTick, this);
    }

    /**
     * Setup the initial grid state and fill up the view with pieces
     * @param config Match3 config params
     */
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        console.log("[Match3Board.setup] rows, columns, tileSize =", this.rows, this.columns, this.tileSize);

        this.piecesMask.width = this.getWidth();
        this.piecesMask.height = this.getHeight();
        this.piecesContainer.visible = true;

        // Reset state
        this.commonTypes.length = 0;
        this.typesMap = {};
        this.reset();

        // The list of blocks (including specials) that will be used in the game
        const blocks = slotGetBlocks();

        // Piece types will be defined according to their positions in the string array of blocks
        for (let i = 0; i < blocks.length; i++) {
            const def = blocks[i];
            const type = i + 1;
            this.commonTypes.push(type);
            this.typesMap[type] = def.symbol;
        }

        // Create the initial grid state
        this.grid = match3CreateGrid(this.rows, this.columns, this.commonTypes);

        // Fill up the visual board with piece sprites
        match3ForEach(this.grid, (gridPosition: Match3Position, type: Match3Type) => {
            const multiplier = (type === 11 || type === 12) ? getRandomMultiplier() : 0;
            this.createPiece(gridPosition, type, multiplier);
        });
    }

    /** Optional: simple reroll, similar to preview.play() */
    public play() {
        this.reset();

        this.grid = match3CreateGrid(this.rows, this.columns, this.commonTypes);

        match3ForEach(this.grid, (gridPosition: Match3Position, type: Match3Type) => {
            const multiplier = (type === 11 || type === 12) ? getRandomMultiplier() : 0;
            this.createPiece(gridPosition, type, multiplier);
        });
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

    public createPiece(position: Match3Position, pieceType: Match3Type, pieceMultiplier: number = 0) {
        const name = this.typesMap[pieceType];
        const piece = pool.get(SlotSymbol);
        const viewPosition = this.getViewPositionByGridPosition(position);

        const multiplier = pieceMultiplier;

        piece.setup({
            name,
            type: pieceType,
            size: this.tileSize || this.match3.config.tileSize,
            interactive: true,
            multiplier
        });

        piece.row = position.row;
        piece.column = position.column;

        // Position piece at its grid slot
        piece.x = viewPosition.x;
        piece.y = viewPosition.y;

        // piece.showBlurSprite();

        this.pieces.push(piece);
        this.piecesContainer.addChild(piece);
        return piece;
    }

    /**
     * Dispose a piece, removing it from the board
     * @param piece Piece to be removed
     */
    public disposePiece(piece: SlotSymbol) {
        const idx = this.pieces.indexOf(piece);
        if (idx !== -1) {
            this.pieces.splice(idx, 1);
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
    public async spawnPiece(position: Match3Position, pieceType: Match3Type, pieceMultiplier: number = 0) {
        const oldPiece = this.getPieceByPosition(position);
        if (oldPiece) this.disposePiece(oldPiece);

        match3SetPieceType(this.grid, position, pieceType);
        if (!pieceType) return;

        const piece = this.createPiece(position, pieceType, pieceMultiplier);
        await piece.animateSpawn();
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
     * Convert grid position (row & column) to view position (x & y)
     * @param position The grid position to be converted
     * @returns The equivalent x & y position in the board
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

    /** Resume all pieces animations */
    public resume() {
        for (const piece of this.pieces) piece.resume();
    }

    /** Bring a piece in front of all others */
    public bringToFront(piece: SlotSymbol) {
        this.piecesContainer.addChild(piece);
    }

    // ----------------------------------------------------------------
    // CLASSIC COLUMN SPIN
    // ----------------------------------------------------------------

    /**
     * Start the "classic slot" spin animation.
     * This does NOT change the logical grid, only the visual y positions.
     */
    public async startClassicSpin(): Promise<void> {
        if (this.spinning) return;
        if (!this.rows || !this.columns || !this.tileSize) {
            console.warn("[Match3Board.startClassicSpin] Board not set up yet.");
            return;
        }

        this.spinning = true;
        this.spinTicker.start();
    }

    /**
     * Stop the spin animation.
     * (You can then snap pieces to final backend reels.)
     */
    public stopClassicSpin(): void {
        if (!this.spinning) return;
        this.spinning = false;
        this.spinTicker.stop();
    }

    /**
     * Ticker callback that moves all columns down and wraps symbols to the top.
     */
    private onSpinTick(ticker: Ticker): void {
        if (!this.spinning) return;
        if (!this.rows || !this.columns || !this.tileSize) return;

        // Pixi's ticker gives you deltaTime (usually ~1 at 60 FPS)
        const delta = ticker.deltaTime;

        const pixelsPerSecond = this.spinTilesPerSecond * this.tileSize;
        const pixelsThisFrame = (pixelsPerSecond / 60) * delta;

        const offsetY = ((this.rows - 1) * this.tileSize) / 2;
        const bottomY = (this.rows - 1) * this.tileSize - offsetY;
        const boardHeight = this.rows * this.tileSize;

        for (const piece of this.pieces) {
            // move down
            piece.y += pixelsThisFrame;

            // wrap from bottom back to top
            if (piece.y > bottomY + this.tileSize * 0.5) {
                piece.y -= boardHeight;

                // ▼ NEW: randomize visual symbol when it wraps
                const randomType =
                    this.commonTypes[Math.floor(Math.random() * this.commonTypes.length)];
                const name = this.typesMap[randomType];
                const multiplier =
                    randomType === 11 || randomType === 12 ? getRandomMultiplier() : 0;

                // reuse the same SlotSymbol instance, just re-setup visuals
                piece.setup({
                    name,
                    type: randomType,
                    size: this.tileSize || this.match3.config.tileSize,
                    interactive: false, // during spin, usually not interactive
                    multiplier,
                });

                piece.showBlurSprite();
            }
        }
    }

    public async applyFinalResult(
        reels: number[][],
        bonusReels: number[][]
    ): Promise<void> {
        // Make sure spin is off
        this.stopClassicSpin();

        // Clear existing random pieces
        this.reset();

        // Copy reels into the logical grid
        this.grid = reels.map(row => [...row]);

        // (Optional but defensive) update rows/columns based on result
        this.rows = reels.length;
        this.columns = reels[0]?.length ?? 0;

        // Spawn pieces for each cell using the final data
        for (let row = 0; row < this.rows; row++) {
            for (let column = 0; column < this.columns; column++) {
                const type = reels[row][column];

                const multiplierFromBackend = bonusReels?.[row]?.[column] ?? 0;
                const multiplier =
                    multiplierFromBackend ||
                    (type === 11 || type === 12 ? getRandomMultiplier() : 0);

                // create SlotSymbol
                const piece = this.createPiece({ row, column }, type, multiplier);

                // ▼ IMPORTANT: hide blur now that final result is showing
                piece.showSpine();
            }
        }
    }



}
