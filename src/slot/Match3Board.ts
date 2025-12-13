import { Container, Graphics, Ticker } from "pixi.js";
import gsap from "gsap";
import { pool } from "../utils/pool";
import { Match3 } from "./Match3";
import { Match3Config, slotGetBlocks } from "./Match3Config";
import { BlurSymbol } from "../ui/BlurSymbol";
import { SlotSymbol } from "./SlotSymbol";

interface ReelColumn {
    container: Container;
    symbols: (BlurSymbol | SlotSymbol)[];
    position: number;
}

export class Match3Board {
    public match3: Match3;

    public rows = 0;
    public columns = 0;
    public tileSize = 0;

    public typesMap!: Record<number, string>;

    // BACKEND RESULTS -------------------------------
    private backendReels: number[][] = [];
    private backendMultipliers: number[][] = [];

    // WILD OVERLAY (PERSISTENT) ----------------------
    private wildGrid: number[][] = [];


    // LAYERS -----------------------------------------
    public piecesContainer: Container;
    public piecesMask: Graphics;

    private blurLayer: Container;
    private realLayer: Container;

    // Persistent overlay
    private wildLayer: Container;

    // REELS ------------------------------------------
    private blurReels: ReelColumn[] = [];
    private realReels: ReelColumn[] = [];
    private wildReels: ReelColumn[] = [];


    // SPIN CONTROL -----------------------------------
    private ticker?: Ticker;
    private _blurSpinning = false;
    private _blurSpinSpeed = 0.45;
    private initialReels: number[][] = [];
    private initialMultipliers: number[][] = [];
    private isTubroSpin = true;

    constructor(match3: Match3) {
        this.match3 = match3;

        // Mask (will be refreshed on setup)
        this.piecesMask = new Graphics();

        // Main container
        this.piecesContainer = new Container();
        this.piecesContainer.mask = this.piecesMask;

        // Add to Match3 root
        this.match3.addChild(this.piecesContainer);
        this.match3.addChild(this.piecesMask);

        // Layers
        this.blurLayer = new Container();
        this.realLayer = new Container();
        this.backendMultipliers = Array.from({ length: 5 }, () => Array(5).fill(0));

        // Persistent top overlay
        this.wildLayer = new Container();
        this.wildGrid = Array.from({ length: 5 }, () => Array(5).fill(0));

        // IMPORTANT: add wildLayer last so it's on top
        this.piecesContainer.addChild(this.blurLayer);
        this.piecesContainer.addChild(this.realLayer);
        this.piecesContainer.addChild(this.wildLayer);
    }

    // =========================================================================
    // UPDATE MASK TO FIT BOARD EXACTLY
    // =========================================================================
    private refreshMask() {
        const w = this.columns * this.tileSize;
        const h = this.rows * this.tileSize;

        const offsetX = w / 2;
        const offsetY = h / 2;

        this.piecesMask.clear();
        this.piecesMask.beginFill(0xffffff, 1);
        this.piecesMask.drawRect(-offsetX, -offsetY, w, h);
        this.piecesMask.endFill();
    }

    // =========================================================================
    // SETUP BOARD
    // =========================================================================
    public setup(config: Match3Config) {
        this.rows = config.rows;
        this.columns = config.columns;
        this.tileSize = config.tileSize;

        const blocks = slotGetBlocks();
        this.typesMap = {};
        for (const b of blocks) this.typesMap[b.type] = b.symbol;

        // Generate random initial board if none provided
        if (this.initialReels.length === 0) {
            this.initialReels = [];
            this.initialMultipliers = [];

            const types = Object.keys(this.typesMap).map(Number);

            for (let r = 0; r < this.rows; r++) {
                this.initialReels[r] = [];
                this.initialMultipliers[r] = [];
                for (let c = 0; c < this.columns; c++) {
                    this.initialReels[r][c] = types[Math.floor(Math.random() * types.length)];
                    this.initialMultipliers[r][c] = 0;
                }
            }
        }

        // Default wild grid (all empty) if none set
        if (this.wildGrid.length === 0) {
            this.wildGrid = Array.from({ length: this.rows }, () =>
                Array.from({ length: this.columns }, () => 0)
            );
        }

        this.refreshMask();

        // build initial visible board
        this.buildInitialRealLayer();

        // build persistent wild overlay structure and apply current grid
        this.rebuildWildLayerStructure();
        this.applyWildGridToWildLayer();

        // Keep wild layer definitely on top
        this.ensureWildLayerOnTop();

        // this.wildLayer.visible = false;
    }

    public setInitialReels(reels: number[][], multipliers: number[][]) {
        this.initialReels = reels;
        this.initialMultipliers = multipliers;
    }

    // =========================================================================
    // PUBLIC: SET WILD OVERLAY GRID (2D [row][col])
    // 0 = empty/invisible (safe)
    // =========================================================================
    public setWildReels(wild: number[][]) {
        this.wildGrid = wild ?? [];
        // If structure already exists, just apply; otherwise it will be applied on setup()
        if (this.rows > 0 && this.columns > 0) {
            this.rebuildWildLayerStructureIfNeeded();
            this.applyWildGridToWildLayer();
            this.ensureWildLayerOnTop();
        }
    }

    // =========================================================================
    // INITIAL REAL LAYER
    // =========================================================================
    private buildInitialRealLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        this.realLayer.removeChildren();
        this.realReels = [];

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            for (let r = 0; r < this.rows; r++) {
                const type = this.initialReels[r][c];
                const mult = this.initialPieceMutliplier(this.initialReels[r][c]);
                const name = this.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier: mult });
                sym.y = r * tile;

                reel.symbols.push(sym);
                col.addChild(sym);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // REBUILD LAYERS BEFORE SPIN (DO NOT TOUCH WILD LAYER)
    // =========================================================================
    private destroyAllLayers() {
        if (this.ticker) {
            this.ticker.stop();
            this.ticker.destroy();
            this.ticker = undefined;
        }

        gsap.killTweensOf(this.blurLayer);
        gsap.killTweensOf(this.realLayer);

        for (const reel of this.blurReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.blurReels = [];
        this.blurLayer.removeChildren();

        for (const reel of this.realReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.realReels = [];
        this.realLayer.removeChildren();

        // Remove old blur/real containers
        if (this.blurLayer.parent) this.blurLayer.parent.removeChild(this.blurLayer);
        if (this.realLayer.parent) this.realLayer.parent.removeChild(this.realLayer);

        // Recreate blur/real
        this.blurLayer = new Container();
        this.realLayer = new Container();

        // IMPORTANT: insert blur/real BELOW wildLayer
        // Ensure wildLayer remains last/top
        const wildIndex = this.piecesContainer.children.indexOf(this.wildLayer);
        const insertIndex = wildIndex >= 0 ? wildIndex : this.piecesContainer.children.length;

        this.piecesContainer.addChildAt(this.blurLayer, Math.min(insertIndex, this.piecesContainer.children.length));
        // After adding blur, wild index may shift; recalc
        const wildIndex2 = this.piecesContainer.children.indexOf(this.wildLayer);
        const insertIndex2 = wildIndex2 >= 0 ? wildIndex2 : this.piecesContainer.children.length;

        this.piecesContainer.addChildAt(this.realLayer, Math.min(insertIndex2, this.piecesContainer.children.length));

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BLUR SYMBOL CREATOR
    // =========================================================================
    private createBlur(): BlurSymbol {
        const types = Object.keys(this.typesMap).map(Number);
        const rand = types[Math.floor(Math.random() * types.length)];
        return new BlurSymbol(rand, this.tileSize);
    }

    // =========================================================================
    // BUILD BLUR LAYER
    // =========================================================================
    private buildBlurLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY - tile;
            this.blurLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            const total = this.rows + 3;
            for (let i = 0; i < total; i++) {
                const blur = this.createBlur();
                blur.y = i * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.blurReels.push(reel);
        }

        this.ticker = new Ticker();
        this.ticker.add(() => this.updateBlurSpin());
        this.ticker.start();

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BUILD REAL LAYER (placeholder blur during spin)
    // =========================================================================
    private buildRealLayer() {
        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.realLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            for (let r = 0; r < this.rows; r++) {
                const blur = this.createBlur();
                blur.y = r * tile;
                col.addChild(blur);
                reel.symbols.push(blur);
            }

            this.realReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    // =========================================================================
    // BLUR SPIN UPDATE
    // =========================================================================
    private updateBlurSpin() {
        if (!this._blurSpinning) return;

        const tile = this.tileSize;

        for (const reel of this.blurReels) {
            reel.position += this._blurSpinSpeed;
            const total = reel.symbols.length;

            for (let i = 0; i < total; i++) {
                const sym = reel.symbols[i];
                const idx = (reel.position + i) % total;
                sym.y = idx * tile;
            }
        }
    }

    private startBlurSpin() {
        this._blurSpinning = true;
    }
    private stopBlurSpin() {
        this._blurSpinning = false;
    }

    // =========================================================================
    // BACKEND APPLIED HERE
    // =========================================================================
    public applyBackendResults(reels: number[][], multipliers: number[][]) {
        // store reels directly
        this.backendReels = reels;
        this.backendMultipliers = multipliers;
    }


    public getBackendReels() {
        return this.backendReels;
    }

    public getBackendMultipliers() {
        return this.backendMultipliers;
    }

    public getWildReels() {
        return this.wildGrid;
    }

    // =========================================================================
    // APPLY BACKEND RESULT TO REAL REELS
    // =========================================================================
    private applyBackendToRealLayer() {
        const tile = this.tileSize;

        for (let c = 0; c < this.columns; c++) {
            const reel = this.realReels[c];

            for (const sym of reel.symbols) sym.destroy();
            reel.symbols = [];
            reel.container.removeChildren();

            for (let r = 0; r < this.rows; r++) {
                const type = this.backendReels[r][c];
                const mult = this.backendMultipliers[r][c];
                const name = this.typesMap[type];

                const sym = new SlotSymbol();
                sym.setup({ name, type, size: tile, multiplier: mult });
                sym.y = r * tile;

                reel.symbols.push(sym);
                reel.container.addChild(sym);
            }
        }

        this.ensureWildLayerOnTop();
    }

    public animateWinningSymbols(wins: { row: number; column: number }[]) {
        for (const pos of wins) {
            const { row, column } = pos;

            const reel = this.realReels[column];
            if (!reel) continue;

            const symbol = reel.symbols[row] as SlotSymbol;
            if (!symbol) continue;

            symbol.animatePlay(true);
        }
    }

    public async startSpin(): Promise<void> {
        const maskH = this.rows * this.tileSize;

        // destroys blur/real only, wild stays intact
        this.destroyAllLayers();

        this.buildBlurLayer();
        this.buildRealLayer();

        this.blurLayer.y = -maskH;
        this.realLayer.y = 0;

        // keep overlay on top
        this.ensureWildLayerOnTop();

        await Promise.all([
            gsap.to(this.realLayer, { y: maskH, duration: 0.25, ease: "power0.out" }),
            gsap.to(this.blurLayer, { y: 0, duration: 0.25, ease: "power0.out" }),
        ]);

        this.startBlurSpin();
    }

    public async finishSpin(): Promise<void> {
        this.stopBlurSpin();
        this.applyBackendToRealLayer();

        const maskH = this.rows * this.tileSize;

        await Promise.all([
            gsap.to(this.blurLayer, {
                y: maskH + this.tileSize * 3,
                duration: 0.35,
                ease: "power2.out",
            }),
            gsap.to(this.realLayer, {
                y: 0,
                duration: 0.35,
                ease: "power2.out",
            }),
        ]);

        // ensure wild is still top
        this.ensureWildLayerOnTop();

        // ⭐ play spine animation for winning pieces
        const wins = this.match3.process.getWinningPositions() ?? [];
        this.animateWinningSymbols(wins);
    }

    public initialPieceMutliplier(symbolType: number) {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier = multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];
        return [11, 12].includes(symbolType) ? randomMultiplier : 0;
    }

    public getTurboSpin() {
        return this.isTubroSpin;
    }

    // =========================================================================
    // WILD LAYER HELPERS (PERSISTENT TOP OVERLAY)
    // =========================================================================
    private ensureWildLayerOnTop() {
        if (!this.wildLayer.parent) {
            this.piecesContainer.addChild(this.wildLayer);
        } else {
            // Force last/top
            this.piecesContainer.setChildIndex(this.wildLayer, this.piecesContainer.children.length - 1);
        }
    }

    private rebuildWildLayerStructureIfNeeded() {
        // If structure doesn't match current board, rebuild it
        if (this.wildReels.length !== this.columns) {
            this.rebuildWildLayerStructure();
            return;
        }
        // Also check each column has correct number of slots
        for (let c = 0; c < this.columns; c++) {
            const reel = this.wildReels[c];
            if (!reel || reel.symbols.length !== this.rows) {
                this.rebuildWildLayerStructure();
                return;
            }
        }
    }

    private rebuildWildLayerStructure() {
        // Clear previous wild symbols/containers but keep wildLayer itself persistent
        for (const reel of this.wildReels) {
            for (const sym of reel.symbols) sym.destroy();
            reel.container.removeChildren();
            reel.container.destroy();
        }
        this.wildReels = [];
        this.wildLayer.removeChildren();

        const tile = this.tileSize;
        const offsetX = ((this.columns - 1) * tile) / 2;
        const offsetY = ((this.rows - 1) * tile) / 2;

        for (let c = 0; c < this.columns; c++) {
            const col = new Container();
            col.x = c * tile - offsetX;
            col.y = -offsetY;
            this.wildLayer.addChild(col);

            const reel: ReelColumn = {
                container: col,
                symbols: [],
                position: 0,
            };

            // Fill with placeholders (we’ll replace/hide safely in applyWildGridToWildLayer)
            for (let r = 0; r < this.rows; r++) {
                // Start empty: use a dummy invisible container child (safe)
                // We'll keep symbol slots consistent per row.
                const dummy = new Container() as any; // lightweight placeholder
                dummy.y = r * tile;
                dummy.visible = false;

                col.addChild(dummy);
                reel.symbols.push(dummy);
            }

            this.wildReels.push(reel);
        }

        this.ensureWildLayerOnTop();
    }

    private applyWildGridToWildLayer() {
        // Make safe even if wildGrid is missing rows/cols
        if (!this.wildReels.length) return;

        console.log("block of WildGridToWildLayer:")
        console.log(this.backendMultipliers);

        const tile = this.tileSize;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                const reel = this.wildReels[c];
                if (!reel) continue;

                const current = reel.symbols[r];
                const type = this.wildGrid?.[r]?.[c] ?? 0;
                const mult = this.backendMultipliers[r]?.[c] ?? 0;

                // 0 = empty/invisible (safe)
                if (type === 0 || !this.typesMap[type]) {
                    // If there is a real SlotSymbol here, destroy it and replace with placeholder
                    if (current && typeof (current as any).destroy === "function" && current instanceof SlotSymbol) {
                        current.destroy();
                    }
                    // Ensure a placeholder exists at that slot
                    reel.container.removeChildAt(r);
                    const dummy = new Container() as any;
                    dummy.y = r * tile;
                    dummy.visible = false;
                    reel.container.addChildAt(dummy, r);
                    reel.symbols[r] = dummy;
                    continue;
                }

                // Need a visible wild symbol at this cell.
                // If current is not a SlotSymbol, replace it.
                if (!(current instanceof SlotSymbol)) {
                    // remove placeholder
                    reel.container.removeChildAt(r);

                    const name = this.typesMap[type];
                    const sym = new SlotSymbol();
                    // multiplier can be 0 for overlay; change later if needed
                    sym.setup({ name, type, size: tile, multiplier: mult});
                    sym.y = r * tile;

                    reel.container.addChildAt(sym, r);
                    reel.symbols[r] = sym;
                } else {
                    // It is already a SlotSymbol; if type changed, rebuild it safely
                    const existing = current as SlotSymbol;
                    // Best-safe approach: destroy & recreate if type differs
                    // (avoids relying on internal SlotSymbol update API)
                    // If you have a "setType" or similar, you can use it instead.
                    if ((existing as any).type !== type) {
                        existing.destroy();
                        reel.container.removeChildAt(r);

                        const name = this.typesMap[type];
                        const sym = new SlotSymbol();
                        sym.setup({ name, type, size: tile, multiplier: 0 });
                        sym.y = r * tile;

                        reel.container.addChildAt(sym, r);
                        reel.symbols[r] = sym;
                    } else {
                        existing.visible = true;
                        existing.y = r * tile;
                    }
                }
            }
        }

        this.ensureWildLayerOnTop();
    }
}
