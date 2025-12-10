import { Container, Graphics, Ticker } from "pixi.js";
import { pool } from "../utils/pool";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import {
    Match3Grid,
    Match3Type,
    Match3Position,
    match3ForEach,
    getRandomMultiplier
} from "./SlotUtility";
import { SlotSymbol } from "./SlotSymbol";

export class Match3Board {
    public match3: Match3;

    public grid: Match3Grid = [];
    public multiplierGrid: Match3Grid = [];

    public realPieces: SlotSymbol[] = [];

    // NEW REEL STRUCTURE (like Pixi demo)
    private reels: {
        container: Container;
        symbols: SlotSymbol[];
        position: number;
        previousPosition: number;
    }[] = [];

    private blurLayer: Container;
    private realLayer: Container;
    public maskShape: Graphics;

    public rows = 0;
    public columns = 0;
    public tileSize = 0;

    public typesMap!: Record<number, string>;

    private spinning = false;
    private spinTicker: any = null;

    // Tween storage
    private tweens: any[] = [];
    private onSpinFullyComplete?: () => void;


    constructor(match3: Match3) {
        this.match3 = match3;

        this.blurLayer = new Container();
        this.realLayer = new Container();
        this.maskShape = new Graphics();

        this.match3.addChild(this.blurLayer);
        this.match3.addChild(this.realLayer);
        this.match3.addChild(this.maskShape);

        this.blurLayer.mask = this.maskShape;
        this.realLayer.mask = this.maskShape;

        (window as any).testSpin = async () => {
            console.log("▶ TEST SPIN");
            await this.startClassicSpin(2000);
            this.stopClassicSpin();
            console.log("■ END");
        };
    }

    // ---------------------------------------------------------
    // SETUP
    // ---------------------------------------------------------
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        this.refreshMask();

        const blocks = slotGetBlocks();
        this.typesMap = {};
        for (const b of blocks) this.typesMap[b.type] = b.symbol;

        const availableTypes = Object.keys(this.typesMap).map(Number);

        this.grid = this.createGrid(availableTypes);
        this.multiplierGrid = this.createGrid([0]);

        this.buildRealLayer();
        this.buildBlurLayer();
    }

    private createGrid(types: number[]): Match3Grid {
        const grid: Match3Grid = [];
        for (let c = 0; c < this.columns; c++) {
            grid[c] = [];
            for (let r = 0; r < this.rows; r++) {
                grid[c][r] = types[Math.floor(Math.random() * types.length)];
            }
        }
        return grid;
    }

    // ---------------------------------------------------------
    // MASK
    // ---------------------------------------------------------
    private refreshMask() {
        const w = this.columns * this.tileSize;
        const h = this.rows * this.tileSize;

        this.maskShape.clear();
        this.maskShape.beginFill(0xffffff, 0.0001);
        this.maskShape.drawRect(-w / 2, -h / 2, w, h);
        this.maskShape.endFill();
    }

    // ---------------------------------------------------------
    // REAL LAYER (STATIC RESULT GRID)
    // ---------------------------------------------------------
    private buildRealLayer() {
        for (const p of this.realPieces) {
            if (p.parent) p.parent.removeChild(p);
            pool.giveBack(p);
        }
        this.realPieces = [];

        match3ForEach(this.grid, (pos, type) => {
            const mult = (type === 11 || type === 12) ? getRandomMultiplier() : 0;

            const piece = pool.get(SlotSymbol);
            piece.setup({
                name: this.typesMap[type],
                type,
                multiplier: mult,
                size: this.tileSize,
                interactive: false
            });

            piece.column = pos.column;
            piece.row = pos.row;

            const view = this.getViewPosition(pos);
            piece.x = view.x;
            piece.y = view.y;

            this.realLayer.addChild(piece);
            this.realPieces.push(piece);
        });

        this.realLayer.visible = false;
    }

    // ---------------------------------------------------------
    // BLUR (SPINNING) LAYER — PIXI SLOT STYLE
    // ---------------------------------------------------------
    private buildBlurLayer() {
        // Clear old reels
        for (const r of this.reels) {
            for (const s of r.symbols) {
                if (s.parent) s.parent.removeChild(s);
                pool.giveBack(s);
            }
        }

        this.reels = [];

        for (let c = 0; c < this.columns; c++) {
            const container = new Container();
            this.blurLayer.addChild(container);

            const reel = {
                container,
                symbols: [] as SlotSymbol[],
                position: 0,
                previousPosition: 0,
            };

            // 7 SYMBOLS (5 visible + 2 buffer above)
            for (let r = -2; r < this.rows; r++) {
                const type = this.randomType();
                const piece = pool.get(SlotSymbol);

                piece.setup({
                    name: this.typesMap[type],
                    type,
                    multiplier: 0,
                    size: this.tileSize,
                    interactive: false
                });

                piece.column = c;
                piece.row = r;

                const view = this.getViewPosition({ column: c, row: r });
                piece.x = view.x;
                piece.y = view.y;

                reel.symbols.push(piece);
                container.addChild(piece);
            }

            this.reels.push(reel);
        }

        this.blurLayer.visible = true;
    }

    private randomType() {
        const keys = Object.keys(this.typesMap);
        return Number(keys[Math.floor(Math.random() * keys.length)]);
    }

    // ---------------------------------------------------------
    private getViewPosition(pos: Match3Position) {
        const offsetX = ((this.columns - 1) * this.tileSize) / 2;
        const offsetY = ((this.rows - 1) * this.tileSize) / 2;

        return {
            x: pos.column * this.tileSize - offsetX,
            y: pos.row * this.tileSize - offsetY
        };
    }

    // ---------------------------------------------------------
    // SPIN START — USING PIXI SLOT TWEEN LOGIC
    // ---------------------------------------------------------
    public async startClassicSpin(duration = 1000) {
        if (this.spinning) return;
        this.spinning = true;

        this.realLayer.visible = false;
        this.blurLayer.visible = true;

        return new Promise<void>(resolve => {
            this.onSpinFullyComplete = () => {
                resolve();
            };

            for (let i = 0; i < this.reels.length; i++) {
                const reel = this.reels[i];

                const extra = Math.floor(Math.random() * 3);
                const target = reel.position + 15 + i * 3 + extra;
                const time = 1800 + i * 250 + extra * 240;

                this.tweenTo(reel, "position", target, time, this.backout(0.45));
            }

            this.spinTicker = (delta: number) => {
                if (!this.spinning) return;
                this.updateTweens();
                this.updateReels(delta);
            };

            Ticker.shared.add(this.spinTicker);
        });
    }


    // ---------------------------------------------------------
    // REEL ANIMATION UPDATE (PIXISLOT STYLE)
    // ---------------------------------------------------------
    private updateReels(delta: number) {
        const SYMBOL_COUNT = this.rows + 2; // 7
        const SYMBOL_SIZE = this.tileSize;

        for (const reel of this.reels) {
            for (let i = 0; i < reel.symbols.length; i++) {
                const s = reel.symbols[i];
                const prevY = s.y;

                // Pixi modulo wrap logic
                const newIndex = ((reel.position + i) % SYMBOL_COUNT) - 2;

                const view = this.getViewPosition({
                    column: s.column,
                    row: newIndex
                });

                s.y = view.y;

                // If looped from bottom → top, randomize
                if (newIndex < -1 && prevY > SYMBOL_SIZE) {
                    const newType = this.randomType();
                    s.type = newType;
                }
            }
        }
    }

    // ---------------------------------------------------------
    // STOP SPIN
    // ---------------------------------------------------------
    public stopClassicSpin() {
        if (!this.spinning) return;
        this.spinning = false;

        Ticker.shared.remove(this.spinTicker);

        this.blurLayer.visible = false;
        this.realLayer.visible = true;
    }

    // ---------------------------------------------------------
    // TWEEN SYSTEM
    // ---------------------------------------------------------
    private tweenTo(object: any, property: string, target: number, time: number, easing: (t: number) => number, oncomplete?: Function) {
        const tween = {
            object,
            property,
            start: Date.now(),
            time,
            easing,
            propertyBeginValue: object[property],
            target,
            oncomplete,
            finished: false
        };
        this.tweens.push(tween);
    }


    private updateTweens() {
        const now = Date.now();
        let allDone = true;

        this.tweens = this.tweens.filter(t => {
            const phase = Math.min(1, (now - t.start) / t.time);
            t.object[t.property] = this.lerp(t.propertyBeginValue, t.target, t.easing(phase));

            if (phase === 1) {
                if (!t.finished) {
                    t.finished = true;
                    if (t.oncomplete) t.oncomplete();
                }
                return false;
            }

            allDone = false;
            return true;
        });

        // When all tweens are finished → complete spin
        if (allDone && this.spinning && this.onSpinFullyComplete) {
            const callback = this.onSpinFullyComplete;
            this.onSpinFullyComplete = undefined;
            callback();
        }
    }


    private lerp(a: number, b: number, t: number) {
        return a * (1 - t) + b * t;
    }

    private backout(amount: number) {
        return (t: number) => --t * t * ((amount + 1) * t + amount) + 1;
    }

    // ---------------------------------------------------------
    public applyFinalReels(finalReels: number[][]) {
        for (const piece of this.realPieces) {
            const t = finalReels[piece.column][piece.row];
            piece.type = t;
        }
    }

    public isSpinning() {
        return this.spinning;
    }
}
