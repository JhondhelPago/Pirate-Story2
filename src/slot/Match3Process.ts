import { BetAPI } from '../api/betApi';
import { Match3 } from './Match3';
import gsap from 'gsap';
import { SlotSymbol } from './SlotSymbol';

/**
 * Slot-style reel spin Match3Process
 * - Spins columns using SlotSymbol (Spine-based)
 * - At end of spin, backend symbols appear smoothly (no jump)
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
     *  SLOT MACHINE SPIN LOGIC
     */
    private async spinWithAnimation() {
        const board = this.match3.board;
        const tileSize = board.tileSize;

        const symbolNames = Object.values(board.typesMap);

        // STEP 1 — Get backend spin result
        const result = await BetAPI.spin("n");
        const reels = result.reels;

        const animPromises: Promise<void>[] = [];

        // STEP 2 — Animate each symbol
        for (const piece of board.pieces) {
            const r = piece.row;
            const c = piece.column;

            const backendType = reels[r][c];
            const backendName = board.typesMap[backendType];

            animPromises.push(
                this.animateColumnSpinLite(
                    piece,
                    symbolNames,
                    tileSize,
                    board.piecesContainer,
                    backendName,      // 🔥 send backend real symbol name
                    backendType       // 🔥 send backend type
                )
            );
        }

        // Wait for ALL animations
        await Promise.all(animPromises);
    }

    /**
     * Reel spin animation for a single REAL grid piece
     * Fake symbols scroll during spin
     * At the very end, realPiece is updated to the backend result
     */
    private animateColumnSpinLite(
        realPiece: SlotSymbol,
        symbolNames: string[],
        tileSize: number,
        reelContainer: any,
        backendName: string,   // 🔥 backend result (string)
        backendType: number    // 🔥 backend type (number)
    ): Promise<void> {

        // Hide real piece during spin
        realPiece.visible = false;

        const finalX = realPiece.x;
        const finalY = realPiece.y;
        const columnIndex = realPiece.column;

        const spinDuration = 1.5;
        const stagger = columnIndex * 0.12;
        const speed = tileSize * 18;
        const fakeCount = 6;

        const fakeSymbols: SlotSymbol[] = [];

        // --- Create fake spin symbols ---
        for (let i = 0; i < fakeCount; i++) {
            const spr = new SlotSymbol();
            const rand = symbolNames[Math.floor(Math.random() * symbolNames.length)];

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

                        // --- FINAL MOMENT: APPLY BACKEND SYMBOL ---
                        realPiece.setup({
                            name: backendName,
                            type: backendType,
                            size: tileSize,
                            interactive: false,
                            multiplier: 0
                        });

                        realPiece.visible = true;

                        // remove fakes
                        fakeSymbols.forEach(s => s.destroy());

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
                        fakeSymbols.forEach(sym => {
                            if (sym.y > finalY + tileSize * 3) {
                                // recycle with random fake
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
