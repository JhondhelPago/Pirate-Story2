import { Container, Texture, AnimatedSprite, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { resolveAndKillTweens, registerCustomEase, pauseTweens, resumeTweens } from '../utils/animation';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

/** Default piece options */
const defaultSlotSymbolOptions = {
    name: '',
    type: 0,
    size: 50,
    interactive: false,
    multiplier: 0,
};

/** Piece configuration parameters */
export type SlotSymbolOptions = typeof defaultSlotSymbolOptions;

/** Custom ease curve for y animation of falling pieces - minimal bounce */
const easeSingleBounce = registerCustomEase(
    'M0,0,C0.14,0,0.27,0.191,0.352,0.33,0.43,0.462,0.53,0.963,0.538,1,0.546,0.997,0.672,0.97,0.778,0.97,0.888,0.97,0.993,0.997,1,1',
);

export class SlotSymbol extends Container {
    /** The actual spine animation of the symbol */
    private spine: Spine;
    /** Explosion animated sprite */
    private explosionSprite: AnimatedSprite | null = null;
    /** True if animations are paused */
    private paused = false;
    /** The row index of the piece */
    public row = 0;
    /** The column index of the piece */
    public column = 0;
    /** The piece type in the grid */
    public type = 0;
    /** The name of the piece - must match one of the available textures */
    public name = '';

    public textLabel: Text;


    /** Test multiplier: 0 = none, 2/3/5 = show sprite */
    public multiplier: number = 0;

    /** Multiplier sprite */
    private multiplierSprite: Sprite | null = null;

    /** Tween reference for animation */
    private multiplierTween?: gsap.core.Tween | gsap.core.Timeline;

    public _isLooping: boolean = false;
    public __match3ProcessRef: any = null;



    constructor() {
        super();

        // Create new spine animation
        this.spine = Spine.from({
            skeleton: `game/symbol-placeholder.json`,
            atlas: `game/symbol-placeholder.atlas`,
        });
        // Center the spine
        this.spine.x = 0;
        this.spine.y = 0;

        // Scale to match size
        this.spine.pivot.set(0.5);
        this.spine.scale.set(0.45);

        // Create explosion animated sprite
        this.createExplosionSprite();

        this.onRender = () => this.renderUpdate();

        this.textLabel = new Text({
            text: this.type,
            style: {
                fontSize: 40,
                fill: '#05e247ff',
                fontWeight: '800',
            },
        });
        this.addChild(this.textLabel);
    }

    /** Create the explosion animated sprite */
    private createExplosionSprite() {
        // Create textures array for the 12 explosion frames
        const explosionTextures = [
            Texture.from('explode-0'),
            Texture.from('explode-1'),
            Texture.from('explode-2'),
            Texture.from('explode-3'),
            Texture.from('explode-4'),
            Texture.from('explode-5'),
            Texture.from('explode-6'),
            Texture.from('explode-7'),
            Texture.from('explode-8'),
            Texture.from('explode-9'),
            Texture.from('explode-10'),
            Texture.from('explode-11'),
        ];

        this.explosionSprite = new AnimatedSprite(explosionTextures);
        this.explosionSprite.anchor.set(0.5);
        this.explosionSprite.loop = false;
        this.explosionSprite.animationSpeed = 0.5;
        this.explosionSprite.visible = false;
        this.addChild(this.explosionSprite);
    }

    /**
     * Set up the visuals. Pieces can be reused and set up with different params freely.
     * @param options The setup options
     */
    public setup(options: Partial<SlotSymbolOptions> = {}) {
        const opts = { ...defaultSlotSymbolOptions, ...options };

        this.killTweens();
        this.paused = false;
        this.visible = true;
        this.alpha = 1;

        this.type = opts.type;
        this.name = opts.name;
        this.scale.set(1);

        // Remove old spine if exists
        if (this.spine) {
            this.removeChild(this.spine);
            this.spine.destroy();
        }

        this.spine = Spine.from({
            skeleton: `game/${opts.name}.json`,
            atlas: `game/${opts.name}.atlas`,
        });

        this.spine.x = 0;
        this.spine.y = 0;
        this.spine.pivot.set(0.5);
        this.spine.scale.set(0.45);
        this.addChildAt(this.spine, 0);

        if (this.explosionSprite) {
            this.explosionSprite.width = opts.size;
            this.explosionSprite.height = opts.size;
            this.explosionSprite.visible = false;
        }

        this.textLabel.text = this.type;

        // RESET multiplier state before assigning the new one
        if (this.multiplierSprite) {
            this.removeChild(this.multiplierSprite);
            this.multiplierSprite.destroy();
            this.multiplierSprite = null;
        }
        if (this.multiplierTween) {
            this.multiplierTween.kill();
            this.multiplierTween = undefined;
        }

        this.multiplier = opts.multiplier ?? 0;


        // ⭐ After multiplier is assigned
        this.updateMultiplierSprite();

        this.unlock();
    }


    /** Fall to position animation */
    public async animateFall(x: number, y: number, onStart?: () => void, onComplete?: () => void) {
        this.lock();
        resolveAndKillTweens(this.position);
        const duration = 0.5;
        await gsap.to(this.position, { x, y, duration, ease: easeSingleBounce, onStart, onComplete });
        this.unlock();
    }

    /** Reel spin animation — moves down repeatedly then lands on final position */
    /** Reel spin animation — smooth scrolling with random temporary symbols */
    /** Reel spin animation — smooth scrolling with random temporary symbols */
    /** Reel spin animation — smooth scrolling with random temporary symbols */
    public async animateColumnSpin(finalX: number, finalY: number, spinIndex: number): Promise<void> {
        this.lock();
        resolveAndKillTweens(this.position);

        const spinDuration = 2;                // total spin time
        const scrollSpeed = 900;               // pixels per second
        const stagger = spinIndex * 0.15;      // delay per column

        // ------------------------------
        // 1. Find reel container safely
        // ------------------------------
        //
        // Your Match3Board creates:
        // match3
        //   └── piecesContainer  <--- real pieces
        //
        // Reel container MUST be: piecesContainer of Board
        //
        const reelContainer = this.parent; // SlotSymbol parent = piecesContainer
        if (!reelContainer) {
            console.warn("animateColumnSpin(): Missing reelContainer");
            this.unlock();
            return;
        }

        // board height = mask height
        const boardHeight = reelContainer.height ?? 600;
        const symbolHeight = this.height * 1.1;

        // ------------------------------
        // 2. Build temporary fake symbols
        // ------------------------------
        const tempSymbols: SlotSymbol[] = [];
        const needed = Math.ceil(boardHeight / symbolHeight) + 3;

        for (let i = 0; i < needed; i++) {
            const fake = new SlotSymbol();   // ✔ safe (no pool)
            fake.setup({
                name: this.name,
                type: this.type,
                size: this.width,
                multiplier: 0,
            });

            fake.x = finalX;
            fake.y = finalY - symbolHeight * i - 200;

            reelContainer.addChild(fake);     // ✔ safe parent add

            tempSymbols.push(fake);
        }

        // Hide real symbol while reel spins
        this.visible = false;

        return new Promise(async (resolve) => {
            await gsap.delayedCall(stagger, async () => {
                let elapsed = 0;

                // ------------------------------
                // 3. Vertical scrolling loop
                // ------------------------------
                while (elapsed < spinDuration) {
                    const dist = symbolHeight;

                    // scroll down all fake symbols
                    const movs = tempSymbols.map(sym =>
                        gsap.to(sym, {
                            y: sym.y + dist,
                            duration: dist / scrollSpeed,
                            ease: "none"
                        })
                    );
                    await Promise.all(movs);

                    // wrap to top for seamless scrolling
                    tempSymbols.forEach(sym => {
                        if (sym.y > boardHeight + 100) {
                            sym.y -= symbolHeight * needed;
                        }
                    });

                    elapsed += dist / scrollSpeed;
                }

                // ------------------------------
                // 4. Cleanup and show real symbol
                // ------------------------------
                tempSymbols.forEach(sym => sym.destroy());

                this.x = finalX;
                this.y = finalY;

                // Fade or bounce real symbol
                this.visible = true;
                gsap.fromTo(this, { y: finalY - 50 }, {
                    y: finalY,
                    ease: "back.out(1.8)",
                    duration: 0.25
                });

                this.unlock();
                resolve();
            });
        });
    }

    /** Play animation */
    public animatePlay(loop: boolean = false): Promise<void> {

        return new Promise((resolve) => {

            const process = (((this.parent as any)?.parent) as any)?.__match3ProcessRef;

            // Prevent infinite invalid loops
            if (loop && this._isLooping) {
                if (!process || process.clusterAnimating === false) {
                    this._isLooping = false;
                    return resolve();
                }
            }

            // Mark as looping
            if (loop) this._isLooping = true;

            const playOnce = () => {

                // Stop immediately if clustering stopped
                if (loop && process && process.clusterAnimating === false) {
                    this._isLooping = false;
                    resolve();
                    return;
                }

                const listener = {
                    complete: () => {
                        this.spine.state.removeListener(listener);

                        if (loop && this._isLooping) {
                            playOnce();              // keep looping
                        } else {
                            this._isLooping = false;  // stop permanently
                            resolve();
                        }
                    },
                };

                this.spine.state.addListener(listener);
                this.spine.state.setAnimation(0, 'animation', false);
            };

            playOnce();
        });
    }


    /** Play animation */
    public async animateSpecialPlay(): Promise<void> {
        this.lock();
        return new Promise((resolve) => {
            const listener = {
                complete: () => {
                    this.spine.state.removeListener(listener);
                    resolve();
                },
            };

            this.spine.state.addListener(listener);
            this.spine.state.setAnimation(0, 'animation', false);
        });
    }

    /** Pop out animation with explosion sprite */
    public async animatePop() {
        this.lock();

        if (this.spine) {
            resolveAndKillTweens(this.spine);
        }

        if (!this.explosionSprite) {
            // Fallback to simple fade if explosion sprite not available
            if (this.spine) {
                const duration = 0.1;
                await gsap.to(this.spine, { alpha: 0, duration, ease: 'sine.out' });
            }
            this.visible = false;
            return;
        }

        // Hide the spine immediately
        if (this.spine) {
            this.spine.visible = false;
        }

        // Show and play explosion animation
        this.explosionSprite.visible = true;
        this.explosionSprite.gotoAndPlay(0);

        // Wait for animation to complete
        await new Promise<void>((resolve) => {
            const onComplete = () => {
                this.explosionSprite!.visible = false;
                this.visible = false;
                resolve();
            };

            this.explosionSprite!.onComplete = onComplete;
        });
    }

    /** Spawn animation */
    public async animateSpawn() {
        this.lock();
        resolveAndKillTweens(this.scale);
        this.scale.set(2);
        this.visible = true;

        const duration = 0.2;
        await gsap.to(this.scale, { x: 1, y: 1, duration, ease: 'back.out' });
        this.unlock();
    }

    public renderUpdate() {
        if (this.paused) return;
        // Spine animations are handled automatically
    }

    /** Resolve and kill all current tweens */
    private killTweens() {
        resolveAndKillTweens(this);
        resolveAndKillTweens(this.position);
        resolveAndKillTweens(this.scale);
        if (this.spine) {
            resolveAndKillTweens(this.spine);
        }
    }

    /** Pause all current tweens */
    public pause() {
        this.paused = true;
        pauseTweens(this);
        pauseTweens(this.position);
        pauseTweens(this.scale);
        if (this.spine) {
            pauseTweens(this.spine);
            this.spine.state.timeScale = 0; // Pause spine animations
        }
        if (this.explosionSprite) {
            this.explosionSprite.stop();
        }
    }

    /** Resume pending tweens */
    public resume() {
        this.paused = false;
        resumeTweens(this);
        resumeTweens(this.position);
        resumeTweens(this.scale);
        if (this.spine) {
            resumeTweens(this.spine);
            this.spine.state.timeScale = 1; // Resume spine animations
        }
        if (this.explosionSprite && this.explosionSprite.visible) {
            this.explosionSprite.play();
        }
    }

    /** Lock piece interactivity, preventing mouse/touch events */
    public lock() {
        this.interactiveChildren = false;
    }

    /** Unlock piece interactivity, preventing mouse/touch events */
    public unlock() {
        this.interactiveChildren = true;
    }

    /** Check if piece is locked */
    public isLocked() {
        return !this.interactiveChildren;
    }

    /** Shortcut to get the grid position of the piece */
    public getGridPosition() {
        return { row: this.row, column: this.column };
    }

    /** Clean up */
    public destroy() {
        if (this.multiplierTween) {
            this.multiplierTween.kill();
            this.multiplierTween = undefined;
        }
        if (this.multiplierSprite) {
            this.removeChild(this.multiplierSprite);
            this.multiplierSprite.destroy();
            this.multiplierSprite = null;
        }

        if (this.spine) {
            this.spine.destroy();
        }
        if (this.explosionSprite) {
            this.explosionSprite.destroy();
        }
        super.destroy();
    }




    /** Create or update the multiplier sprite */
    private updateMultiplierSprite() {
        // Remove old sprite if needed
        if (this.multiplierSprite) {
            this.removeChild(this.multiplierSprite);
            this.multiplierSprite.destroy();
            this.multiplierSprite = null;
        }

        // If multiplier = 0 → show nothing
        if (this.multiplier === 0) return;

        // Pick correct asset based on multiplier value
        const assetName =
            this.multiplier === 2 ? '2XMutliplier' :
                this.multiplier === 3 ? '3XMutliplier' :
                    this.multiplier === 5 ? '5XMutliplier' :
                        null;

        if (!assetName) return;

        // Create sprite
        this.multiplierSprite = Sprite.from(assetName);
        this.multiplierSprite.anchor.set(0.5);
        this.multiplierSprite.scale.set(0.65);

        // Position BELOW the symbol (but still top layer visually)
        this.multiplierSprite.y = 40; // adjust to your icon height
        this.multiplierSprite.x = 0;

        // Add to top layer
        this.addChild(this.multiplierSprite);

        // Floating animation
        this.applyMultiplierAnimation();
    }

    /** Apply float + zoom animation to multiplier */
    /** Apply fade-in + zoom-in intro and then idle floating animation */
    private applyMultiplierAnimation() {
        if (!this.multiplierSprite) return;

        // Kill existing animation
        if (this.multiplierTween) {
            this.multiplierTween.kill();
        }

        const target = this.multiplierSprite;

        // Reset initial state
        target.alpha = 0;
        target.scale.set(0.4); // start smaller
        const baseY = target.y; // remember base Y

        // Timeline
        this.multiplierTween = gsap.timeline({ repeat: 0 })
            // ⭐ FADE-IN + ZOOM-IN INTRO
            .to(target, {
                alpha: 1,
                scale: .68,
                duration: 0.35,
                ease: "back.out(1.8)",
            })
            // ⭐ AFTER intro → start floating idle animation
            .to(target, {
                y: baseY - 8,
                duration: 0.8,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
    }

    public getSpine() {
        return this.spine;
    }


    public stopAnimationImmediately() {
        this._isLooping = false;

        if (this.spine) {
            this.spine.state.clearTracks();        // remove all animations immediately
            this.spine.state.setEmptyAnimation(0, 0); // reset animation track
        }

    }





}
