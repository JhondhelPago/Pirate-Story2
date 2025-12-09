import { Container, Graphics } from 'pixi.js';
import { pool } from '../utils/pool';
import { Match3 } from './Match3';
import { Match3Config, slotGetBlocks } from './Match3Config';
import {
    Match3Position,
    match3SetPieceType,
    match3GetPieceType,
    match3ForEach,
    Match3Grid,
    Match3Type,
    getRandomMultiplier
} from './SlotUtility';
import { SlotSymbol } from './SlotSymbol';

/**
 * SlotBoard (Column-major FIXED version)
 * --------------------------------------
 * Matches how your SlotProcess, Cluster logic, and backend mapping works:
 *
 * Grid Shape:
 *      grid[column][row]
 *
 * This prevents invalid array lengths and keeps the engine consistent.
 */
export class Match3Board {
    public match3: Match3;

    /** Numeric grids (column-major) */
    public grid: Match3Grid = [];            // [column][row]
    public multiplierGrid: Match3Grid = [];  // [column][row]

    public pieces: SlotSymbol[] = [];

    public piecesMask: Graphics;
    public piecesContainer: Container;

    public rows = 0;
    public columns = 0;
    public tileSize = 0;

    public typesMap!: Record<number, string>;

    constructor(match3: Match3) {
        this.match3 = match3;

        this.piecesContainer = new Container();
        this.piecesContainer.sortableChildren = true;
        this.match3.addChild(this.piecesContainer);

        this.piecesMask = new Graphics();
        this.piecesContainer.addChild(this.piecesMask);

        this.piecesContainer.mask = this.piecesMask;
    }

    // ------------------------------------------------------------
    // SETUP
    // ------------------------------------------------------------
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        this.refreshMask();

        /** Build type-map from block list */
        const blocks = slotGetBlocks();
        this.typesMap = {};

        for (const block of blocks) {
            this.typesMap[block.type] = block.symbol;
        }

        const availableTypes = Object.keys(this.typesMap).map(Number);

        /** Create grids (COLUMN-MAJOR) */
        this.grid = this.createColumnMajorGrid(this.columns, this.rows, availableTypes);
        this.multiplierGrid = this.createColumnMajorGrid(this.columns, this.rows, [0]);

        /** Create initial pieces */
        match3ForEach(this.grid, (pos, type) => {
            const isWild = type === 11 || type === 12;
            const mult = isWild ? getRandomMultiplier() : 0;

            this.multiplierGrid[pos.column][pos.row] = mult;
            this.createPiece(pos, type, mult);
        });
    }

    // ------------------------------------------------------------
    // GRID GENERATOR (COLUMN-MAJOR)  <--- FIXED
    // ------------------------------------------------------------
    private createColumnMajorGrid(columns: number, rows: number, types: number[]): Match3Grid {
        const grid: Match3Grid = [];

        for (let c = 0; c < columns; c++) {
            grid[c] = [];

            for (let r = 0; r < rows; r++) {
                if (types.length > 0) {
                    const t = types[Math.floor(Math.random() * types.length)];
                    grid[c][r] = t;
                } else {
                    grid[c][r] = 0;
                }
            }
        }

        return grid;
    }

    // ------------------------------------------------------------
    // MASK
    // ------------------------------------------------------------
    private refreshMask() {
        const w = this.columns * this.tileSize;
        const h = this.rows * this.tileSize;

        const offsetX = ((this.columns - 1) * this.tileSize) / 2;
        const offsetY = ((this.rows - 1) * this.tileSize) / 2;

        this.piecesMask.clear();
        this.piecesMask.beginFill(0xffffff, 0.0001);
        this.piecesMask.drawRect(
            -offsetX - this.tileSize / 2,
            -offsetY - this.tileSize / 2,
            w,
            h
        );
        this.piecesMask.endFill();
    }

    // ------------------------------------------------------------
    // RESET / CLEAR
    // ------------------------------------------------------------
    public reset() {
        for (const p of this.pieces) this.disposePiece(p);
        this.pieces = [];
    }

    public clearGridOnly() {
        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {
                this.grid[c][r] = 0;
                this.multiplierGrid[c][r] = 0;
            }
        }
    }

    // ------------------------------------------------------------
    // CREATE / REMOVE PIECES
    // ------------------------------------------------------------
    public createPiece(position: Match3Position, type: Match3Type, multiplier = 0) {
        const name = this.typesMap[type];
        const piece = pool.get(SlotSymbol);

        const view = this.getViewPositionByGridPosition(position);

        piece.setup({
            name,
            type,
            size: this.tileSize,
            multiplier,
            interactive: false
        });

        piece.row = position.row;
        piece.column = position.column;

        piece.x = view.x;
        piece.y = view.y;

        this.pieces.push(piece);
        this.piecesContainer.addChild(piece);

        return piece;
    }

    public async spawnPiece(position: Match3Position, type: Match3Type, multiplier = 0) {
        const old = this.getPieceByPosition(position);
        if (old) this.disposePiece(old);

        match3SetPieceType(this.grid, position, type);
        this.multiplierGrid[position.column][position.row] = multiplier;

        if (!type) return;

        this.createPiece(position, type, multiplier);
    }

    public async popPiece(position: Match3Position) {
        const piece = this.getPieceByPosition(position);
        if (piece) this.disposePiece(piece);

        match3SetPieceType(this.grid, position, 0);
        this.multiplierGrid[position.column][position.row] = 0;
    }

    public async popPieces(positions: Match3Position[]) {
        for (const pos of positions) await this.popPiece(pos);
    }

    public disposePiece(piece: SlotSymbol) {
        const index = this.pieces.indexOf(piece);
        if (index !== -1) this.pieces.splice(index, 1);

        if (piece.parent) piece.parent.removeChild(piece);

        pool.giveBack(piece);
    }

    // ------------------------------------------------------------
    // QUERIES
    // ------------------------------------------------------------
    public getPieceByPosition(pos: Match3Position) {
        return this.pieces.find(
            p => p.row === pos.row && p.column === pos.column
        ) || null;
    }

    public getViewPositionByGridPosition(pos: Match3Position) {
        const offsetX = ((this.columns - 1) * this.tileSize) / 2;
        const offsetY = ((this.rows - 1) * this.tileSize) / 2;

        return {
            x: pos.column * this.tileSize - offsetX,
            y: pos.row * this.tileSize - offsetY
        };
    }

    public getWidth() { return this.tileSize * this.columns; }
    public getHeight() { return this.tileSize * this.rows; }

    public bringToFront(piece: SlotSymbol) {
        this.piecesContainer.addChild(piece);
    }

    public pause() { for (const p of this.pieces) p.pause?.(); }
    public resume() { for (const p of this.pieces) p.resume?.(); }
}
