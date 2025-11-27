import { Container } from 'pixi.js';
import { randomRange } from '../utils/random';
import gsap from 'gsap';
import { GameScreen } from '../screens/GameScreen';
import { earthquake } from '../utils/animation';
import { getDistance } from '../utils/maths';
import { pool } from '../utils/pool';
import { sfx } from '../utils/audio';
import { PopExplosion } from './PopExplosion';
import { waitFor } from '../utils/asyncUtils';
import { SlotSymbol } from '../slot/SlotSymbol';
import { SlotOnJackpotMatchData } from '../slot/Match3';

/**
 * All gameplay special effects, isolated on its own class in a way that can be changed freely, without affecting gameplay.
 * List of special effects in this class:
 * - Piece Move - Play a short sfx accordingly if the movement is allowed or not
 * - Piece Explosion - When a piece is popped out, play a little explosion animation in place
 * - Piece Pop - When a non-special piece is popped out, it flies to the cauldron
 * - Match Done - When a match happens, play sfx and "shake" the game according to the combo level
 * - Gird Explosion - Explode all pieces out of the grid, played when gameplay finishes
 */
export class GameEffects extends Container {
    /** The game screen instance */
    private game: GameScreen;

    constructor(game: GameScreen) {
        super();
        this.game = game;
        this.sortableChildren = true;
        this.onRender = () => this.renderUpdate();
    }

    /** Auto-update every frame */
    public renderUpdate() {
        // Update children z indexes to auto organise their order according
        // to their scales, to create a sort of a "3d depth" simulation
        for (const child of this.children) {
            child.zIndex = child.scale.x;
        }
    }

    /** Fired when a match is detected */
    public async onJackpotMatch(data: SlotOnJackpotMatchData) {
        sfx.play('common/sfx-match.wav');
        let pieces = []; // Store pieces to clean up later
        const animPromise: Promise<void>[] = [];

        // Process each group sequentially
        for (let i = 0; i < data.symbols.length; i++) {
            const position = this.toLocal(data.symbols[i].getGlobalPosition());
            const piece = pool.get(SlotSymbol);
            piece.setup({
                name: data.symbols[i].name,
                type: data.symbols[i].type,
                size: this.game.match3.board.tileSize,
                interactive: false,
            });
            piece.position.copyFrom(position);
            this.addChild(piece);

            pieces.push(piece); // Store for cleanup

            let x = 0;
            let y = 0;

            // IDENTIFY PIECE WHERE THEY FLY TO
            if (piece.type == 9 && this.game.grandJackpotTier) {
                x = this.game.grandJackpotTier.x + randomRange(-20, 20);
                y = this.game.grandJackpotTier.y;
            } else if (piece.type == 10 && this.game.angelicJackpotTier) {
                x = this.game.angelicJackpotTier.x + randomRange(-20, 20);
                y = this.game.angelicJackpotTier.y;
            } else if (piece.type == 11 && this.game.blessedJackpotTier) {
                x = this.game.blessedJackpotTier.x + randomRange(-20, 20);
                y = this.game.blessedJackpotTier.y;
            } else if (piece.type == 12 && this.game.divineJackpotTier) {
                x = this.game.divineJackpotTier.x + randomRange(-20, 20);
                y = this.game.divineJackpotTier.y;
            }

            animPromise.push(this.playFlyToMultiplier(piece, { x, y }));
        }

        await Promise.all(animPromise);

        // Now clean up after animations are done
        for (const piece of pieces) {
            this.removeChild(piece);
            pool.giveBack(piece);
        }
    }

    /** Make the piece fly to cauldron with a copy of the original piece created in its place */
    public async playFlyToMultiplier(piece: SlotSymbol, to: { x: number; y: number }) {
        const distance = getDistance(piece.x, piece.y, to.x, to.y);
        const duration = distance * 0.0008 + randomRange(0.3, 0.6);

        gsap.killTweensOf(piece);
        gsap.killTweensOf(piece.scale);
        gsap.killTweensOf(piece, 'rotation');

        const tl = gsap.timeline();

        tl.to(
            piece,
            {
                x: to.x,
                y: to.y,
                duration: duration,
                ease: 'power1.inOut',
            },
            0,
        );

        tl.to(
            piece.scale,
            {
                x: 0.5,
                y: 0.5,
                duration: duration,
                ease: 'power1.in',
            },
            0,
        );

        tl.to(
            piece,
            {
                alpha: 0,
                duration: duration * 0.5,
                ease: 'power1.in',
            },
            duration * 0.5,
        );

        await tl;

        /** Evaluate jackpot matches */
        const jackpots = this.game.match3.jackpot.jackpots;
        const active = jackpots[piece.type].active;

        if (piece.type == 9) {
            this.game.grandJackpotTier.setActiveDots(active);
        } else if (piece.type == 10) {
            this.game.angelicJackpotTier.setActiveDots(active);
        } else if (piece.type == 11) {
            this.game.blessedJackpotTier.setActiveDots(active);
        } else if (piece.type == 12) {
            this.game.divineJackpotTier.setActiveDots(active);
        }

        sfx.play('common/sfx-bubble.wav');
    }

    /** Play a short explosion effect in given position */
    private async playPopExplosion(position: { x: number; y: number }) {
        const explosion = pool.get(PopExplosion);
        explosion.x = position.x;
        explosion.y = position.y;
        this.addChild(explosion);
        await explosion.play();
        this.removeChild(explosion);
        pool.giveBack(explosion);
    }

    /** Explode piece out of the board, part of the play grid explosion animation */
    private async playPieceExplosion(piece: SlotSymbol) {
        const position = this.toLocal(piece.getGlobalPosition());
        const x = position.x + piece.x * 2 + randomRange(-100, 100);
        const yUp = position.y + randomRange(-100, -200);
        const yDown = yUp + 600;
        const animatedPiece = pool.get(SlotSymbol);
        const duration = randomRange(0.5, 0.8);
        gsap.killTweensOf(animatedPiece);
        gsap.killTweensOf(animatedPiece.scale);
        animatedPiece.setup({
            name: piece.name,
            type: piece.type,
            size: this.game.match3.board.tileSize,
            interactive: false,
        });
        animatedPiece.position.copyFrom(position);
        animatedPiece.alpha = 1;
        this.addChild(animatedPiece);
        await waitFor(randomRange(0, 0.3));

        this.playPopExplosion(position);

        const upTime = duration * 0.4;
        const downTime = duration * 0.5;
        const curveTime = duration * 0.1;

        // Create timeline for smoother control
        const tl = gsap.timeline();

        // Up motion
        tl.to(animatedPiece, { y: yUp, duration: upTime, ease: 'circ.out' }, 0);

        // Down motion with curve at the end
        tl.to(
            animatedPiece,
            {
                y: yDown - 50, // Stop a bit before final position
                duration: downTime,
                ease: 'circ.in',
            },
            upTime,
        );

        // Final curve down
        tl.to(
            animatedPiece,
            {
                y: yDown,
                duration: curveTime,
                ease: 'power2.in',
            },
            upTime + downTime,
        );

        // Horizontal movement with curve at the end
        tl.to(
            animatedPiece,
            {
                x: x - 30, // Stop before final position
                duration: duration - curveTime,
                ease: 'linear',
            },
            0,
        );

        // Final horizontal curve
        tl.to(
            animatedPiece,
            {
                x: x,
                duration: curveTime,
                ease: 'power2.in',
            },
            duration - curveTime,
        );

        // Fade and scale
        tl.to(animatedPiece, { alpha: 0, duration: 0.2, ease: 'linear' }, duration - 0.2);
        tl.to(animatedPiece.scale, { x: 2, y: 2, duration, ease: 'linear' }, 0);

        await tl;

        this.removeChild(animatedPiece);
        pool.giveBack(piece);
    }

    /** Explode all pieces out of the board, when gameplay finishes */
    public async playGridExplosion() {
        earthquake(this.game.pivot, 10);
        const animPromises: Promise<void>[] = [];
        this.game.match3.board.pieces.forEach((piece) => {
            animPromises.push(this.playPieceExplosion(piece));
        });
        this.game.match3.board.piecesContainer.visible = false;
        await Promise.all(animPromises);
    }
}
