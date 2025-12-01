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
    getRandomMultiplier
} from './SlotUtility';
import { SlotSymbol } from './SlotSymbol';

export class Match3Board {
    public match3: Match3;
    public grid: Match3Grid = [];
    public pieces: SlotSymbol[] = [];
    public piecesMask: Graphics;
    public piecesContainer: Container;
    public rows = 0;
    public columns = 0;
    public tileSize = 0;
    public typesMap!: Record<number, string>;

    constructor(match3: Match3) {
        this.match3 = match3;

        /** Container where ALL spins and fake symbols will appear */
        this.piecesContainer = new Container();
        this.match3.addChild(this.piecesContainer);

        /** FIXED MASK — Now dynamic based on board size */
        this.piecesMask = new Graphics();
        this.match3.addChild(this.piecesMask);

        this.piecesContainer.mask = this.piecesMask;
    }

    /** Setup board and FIX mask */
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        this.refreshMask();

        const blocks = slotGetBlocks();
        this.typesMap = {};

        for (let i = 0; i < blocks.length; i++) {
            const name = blocks[i];
            const type = i + 1;
            this.typesMap[type] = name.symbol;
        }

        /** Create grid */
        this.grid = match3CreateGrid(this.rows, this.columns, Object.keys(this.typesMap).map(Number));

        /** Create visible real symbols */
        match3ForEach(this.grid, (pos, type) => {
            const multiplier = (type === 5 || type === 12) ? getRandomMultiplier() : 0;
            this.createPiece(pos, type, multiplier);
        });
    }

    /** 🔥 FIX: Proper mask redrawn every time */
    private refreshMask() {
        const w = this.getWidth();
        const h = this.getHeight();

        this.piecesMask.clear();
        this.piecesMask
            .beginFill(0xffffff, 1)
            .drawRect(-w / 2, -h / 2, w, h)
            .endFill();
    }

    public reset() {
        for (const p of this.pieces) this.disposePiece(p);
        this.pieces = [];
    }

    public clear() {
        for (let col = 0; col < this.columns; col++) {
            for (let row = 0; row < this.rows; row++) {
                this.grid[col][row] = 0;
            }
        }
    }

    /** Create a visual piece */
    public createPiece(position: Match3Position, type: Match3Type, multiplier: number = 0) {
        const name = this.typesMap[type];
        const piece = pool.get(SlotSymbol);
        const view = this.getViewPositionByGridPosition(position);

        piece.setup({
            name,
            type,
            size: this.tileSize,
            multiplier: multiplier,
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

    public async spawnPiece(position: Match3Position, type: Match3Type) {
        const old = this.getPieceByPosition(position);
        if (old) this.disposePiece(old);

        match3SetPieceType(this.grid, position, type);

        if (!type) return;

        this.createPiece(position, type);
    }

    public async playPiece() { return; }
    public async popPiece(position: Match3Position) {
        const p = this.getPieceByPosition(position);
        if (p) this.disposePiece(p);
        match3SetPieceType(this.grid, position, 0);
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

    public getPieceByPosition(pos: Match3Position) {
        return this.pieces.find(p => p.row === pos.row && p.column === pos.column) || null;
    }

    public getViewPositionByGridPosition(position: Match3Position) {
        const offsetX = ((this.columns - 1) * this.tileSize) / 2;
        const offsetY = ((this.rows - 1) * this.tileSize) / 2;

        return {
            x: position.column * this.tileSize - offsetX,
            y: position.row * this.tileSize - offsetY
        };
    }

    public getWidth() {
        return this.tileSize * this.columns;
    }

    public getHeight() {
        return this.tileSize * this.rows;
    }

    public pause() {}
    public resume() {}

    public bringToFront(piece: SlotSymbol) {
        this.piecesContainer.addChild(piece);
    }
}
