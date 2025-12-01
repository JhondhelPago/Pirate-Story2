import { BetAPI } from '../api/betApi';
import { Match3 } from './Match3';
import gsap from 'gsap';
import { SlotSymbol } from './SlotSymbol';

/**
 * Slot-style reel spin Match3Process
 * - Spins columns using SlotSymbol (Spine-based)
 * - After spin, backend symbols appear instantly
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
        if (this.processing) return;

        this.processing = true;

        await this.spinWithAnimation();

        this.processing = false;

        this.match3.onProcessComplete?.();
    }

    /**
     *  SLOT MACHINE SPIN ANIMATION (Spine-based SlotSymbol fakes)
     */
    private async spinWithAnimation() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        // List of available symbol names (from typesMap)
        const symbolNames = Object.values(board.typesMap);

        // STEP 1 — Ask backend for spin result
        const result = await BetAPI.spin("n");
        const reels = result.reels;
        const bonus = result.bonusReels;

        const animPromises: Promise<void>[] = [];

        // STEP 2 — Animate each real symbol with spin effect
        for (const piece of board.pieces) {
            animPromises.push(
                this.animateColumnSpinLite(
                    piece,
                    symbolNames,
                    tileSize,
                    board.piecesContainer
                )
            );
        }

        // Wait until ALL columns finished spinning
        await Promise.all(animPromises);

        // STEP 3 — Remove old pieces
        for (const p of board.pieces) {
            p.destroy();
        }
        board.pieces = [];

        // STEP 4 — Put backend symbols instantly
        board.grid = reels;

        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.columns; col++) {
                const position = { row, column: col };
                const type = reels[row][col];
                const mult = bonus[row][col];

                const piece = board.createPiece(position, type, mult);
                piece.visible = true;

                // Optional bounce
                gsap.from(piece, {
                    y: piece.y - 40,
                    duration: 0.25,
                    ease: "back.out(1.4)"
                });
            }
        }
    }

    /**
     * Lightweight REEL SPIN for a single symbol
     * Uses SlotSymbol instead of PNG textures (FIXED)
     */
    private animateColumnSpinLite(
        realPiece: any,
        symbolNames: string[],
        tileSize: number,
        reelContainer: any
    ): Promise<void> {

        realPiece.visible = false;

        const finalX = realPiece.x;
        const finalY = realPiece.y;
        const columnIndex = realPiece.column;

        const spinDuration = 1.5;
        const stagger = columnIndex * 0.12;
        const speed = tileSize * 18;
        const fakeCount = 6;

        const fakeSymbols: SlotSymbol[] = [];

        // Build fake reel symbols (USING SLOT SYMBOL)
        for (let i = 0; i < fakeCount; i++) {
            const rand = symbolNames[Math.floor(Math.random() * symbolNames.length)];

            const spr = new SlotSymbol();
            spr.setup({
                name: rand,
                type: 0,
                size: tileSize,
                interactive: false,
                multiplier: 0
            });

            spr.x = finalX;
            spr.y = finalY - tileSize * i - tileSize * 4;

            reelContainer.addChild(spr);
            fakeSymbols.push(spr);
        }

        return new Promise((resolve) => {
            gsap.delayedCall(stagger, () => {
                let elapsed = 0;

                const loop = () => {
                    if (elapsed >= spinDuration) {
                        // Cleanup
                        fakeSymbols.forEach(s => s.destroy());
                        realPiece.visible = true;
                        resolve();
                        return;
                    }

                    const dist = tileSize;
                    const step = dist / speed;

                    const moves = fakeSymbols.map(sym =>
                        gsap.to(sym, {
                            y: sym.y + dist,
                            duration: step,
                            ease: "none"
                        })
                    );

                    Promise.all(moves).then(() => {
                        // recycle symbols that scrolled out of view
                        fakeSymbols.forEach(sym => {
                            if (sym.y > finalY + tileSize * 3) {
                                const rand = symbolNames[Math.floor(Math.random() * symbolNames.length)];

                                sym.setup({
                                    name: rand,
                                    type: 0,
                                    size: tileSize,
                                    interactive: false,
                                    multiplier: 0
                                });

                                sym.y -= tileSize * fakeCount;
                            }
                        });

                        elapsed += step;
                        loop();
                    });
                };

                loop();
            });
        });
    }

    public async stop() {
        this.processing = false;
    }
}
