import { BetAPI } from '../api/betApi';
import { Match3 } from './Match3';
import gsap from 'gsap';
import { SlotSymbol } from './SlotSymbol';

/**
 * Slot-style reel spin Match3Process
 * - Spins columns using SlotSymbol (Spine-based)
 * - Smooth transition: real symbols fade + slide before fake scroll starts
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

        // STEP 1 — backend result
        const result = await BetAPI.spin("n");
        const reels = result.reels;
        const bonus = result.bonusReels;

        const animPromises: Promise<void>[] = [];

        // STEP 2 — animate each symbol
        for (const piece of board.pieces) {
            const r = piece.row;
            const c = piece.column;

            const backendType = reels[r][c];
            const backendMultiplier = bonus[r][c];
            const backendName = board.typesMap[backendType];

            animPromises.push(
                this.animateColumnSpinLite(
                    piece,
                    symbolNames,
                    tileSize,
                    board.piecesContainer,
                    backendName,
                    backendType,
                    backendMultiplier
                )
            );
        }

        await Promise.all(animPromises);
    }

    /**
     * Smooth spin for each real grid piece
     */
    private animateColumnSpinLite(
        realPiece: SlotSymbol,
        symbolNames: string[],
        tileSize: number,
        reelContainer: any,
        backendName: string,
        backendType: number,
        backendMultiplier: number
    ): Promise<void> {

        const finalX = realPiece.x;
        const finalY = realPiece.y;
        const columnIndex = realPiece.column;

        const spinDuration = 1.5;
        const stagger = columnIndex * 0.12;
        const speed = tileSize * 18;
        const fakeCount = 6;

        const fakeSymbols: SlotSymbol[] = [];

        // Pre-create fake symbols (hidden)
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
            spr.visible = false;

            reelContainer.addChild(spr);
            fakeSymbols.push(spr);
        }

        return new Promise(resolve => {
            gsap.delayedCall(stagger, () => {

                // ------------------------------------
                // 🔥 SMOOTH TRANSITION BEFORE HIDING
                // ------------------------------------
                gsap.to(realPiece, {
                    alpha: 0.4,
                    y: realPiece.y + 4,
                    duration: 0.15,
                    ease: "power1.out",
                    onComplete: () => {
                        // hide the real piece ONLY after fade
                        realPiece.visible = false;
                        realPiece.alpha = 1;
                        realPiece.y = finalY;
                    }
                });

                // Turn on fake symbols
                fakeSymbols.forEach(s => s.visible = true);

                let elapsed = 0;

                const loop = () => {
                    if (elapsed >= spinDuration) {

                        // Place backend symbol at exact location
                        realPiece.setup({
                            name: backendName,
                            type: backendType,
                            size: tileSize,
                            interactive: false,
                            multiplier: backendMultiplier
                        });

                        realPiece.x = finalX;
                        realPiece.y = finalY;
                        realPiece.visible = true;

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
