import { Container, Texture, AnimatedSprite, Text, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { resolveAndKillTweens, registerCustomEase, pauseTweens, resumeTweens } from '../utils/animation';
import { Physics, Spine } from '@esotericsoftware/spine-pixi-v8';

/** Default piece options */
const defaultSlotSymbolOptions = {
    type: 0,
    size: 50,
    interactive: false,
    multiplier: 0,

    // ✅ NEW (optional): if you want to pass bonus in setup
    // bonus: false,
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

    private sprite: Sprite | null = null;

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

    /** One-shot “trigger” effect tween for multiplier (jump + shake-on-air + shake-on-land) */
    private multiplierTriggerTween?: gsap.core.Tween | gsap.core.Timeline;

    public _isLooping: boolean = false;
    public __match3ProcessRef: any = null;

    // =========================================================
    // ✅ NEW: BONUS COIN MARKER (top-right) + effect
    // =========================================================
    /** Bonus flag: show/hide coin marker */
    private bonus = false;

    /** Bonus coin sprite */
    private bonusSprite: Sprite | null = null;

    /** Bonus animation tween */
    private bonusTween?: gsap.core.Tween | gsap.core.Timeline;

    public static readonly VISUAL_SCALE = 1.18; // or 1.1 etc

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
        this.spine.scale.set(2);

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
        this.textLabel.visible = true;
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
        this.scale.set(1);

        // Remove old spine if exists
        if (this.spine) {
            this.removeChild(this.spine);
            this.spine.destroy();
        }

        this.spine = Spine.from({
            skeleton: `game/symbol-${opts.type}.json`,
            atlas: `game/symbol-${opts.type}.atlas`,
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
        if (this.multiplierTriggerTween) {
            this.multiplierTriggerTween.kill();
            this.multiplierTriggerTween = undefined;
        }

        this.multiplier = opts.multiplier ?? 0;

        // ⭐ After multiplier is assigned
        this.updateMultiplierSprite();

        // =========================================================
        // ✅ NEW: reset & re-apply bonus visuals based on current flag
        // =========================================================
        if (this.bonusTween) {
            this.bonusTween.kill();
            this.bonusTween = undefined;
        }
        if (this.bonusSprite) {
            this.removeChild(this.bonusSprite);
            this.bonusSprite.destroy();
            this.bonusSprite = null;
        }
        this.updateBonusSprite();
        // =========================================================

        this.unlock();
    }

    /** Fall to position animation */
    public async animateFall(x: number, y: number, onStart?: () => void, onComplete?: () => void) {
        this.lock();
        resolveAndKillTweens(this.position);
        const duration = 0.5;
        await gsap.to(this.position, {
            x,
            y,
            duration,
            ease: easeSingleBounce,
            onStart,
            onComplete,
        });
        this.unlock();
    }

    /** Reel spin animation — smooth scrolling with random temporary symbols */
    public async animateColumnSpin(finalX: number, finalY: number, spinIndex: number): Promise<void> {
        this.lock();
        resolveAndKillTweens(this.position);

        const spinDuration = 2; // total spin time
        const scrollSpeed = 900; // pixels per second
        const stagger = spinIndex * 0.15; // delay per column

        const reelContainer = this.parent; // SlotSymbol parent = piecesContainer
        if (!reelContainer) {
            console.warn('animateColumnSpin(): Missing reelContainer');
            this.unlock();
            return;
        }

        const boardHeight = reelContainer.height ?? 600;
        const symbolHeight = this.height * 1.1;

        const tempSymbols: SlotSymbol[] = [];
        const needed = Math.ceil(boardHeight / symbolHeight) + 3;

        for (let i = 0; i < needed; i++) {
            const fake = new SlotSymbol();
            fake.setup({
                type: this.type,
                size: this.width,
                multiplier: 0,
            });

            fake.x = finalX;
            fake.y = finalY - symbolHeight * i - 200;

            reelContainer.addChild(fake);
            tempSymbols.push(fake);
        }

        this.visible = false;

        return new Promise(async (resolve) => {
            await gsap.delayedCall(stagger, async () => {
                let elapsed = 0;

                while (elapsed < spinDuration) {
                    const dist = symbolHeight;

                    const movs = tempSymbols.map((sym) =>
                        gsap.to(sym, {
                            y: sym.y + dist,
                            duration: dist / scrollSpeed,
                            ease: 'none',
                        }),
                    );
                    await Promise.all(movs);

                    tempSymbols.forEach((sym) => {
                        if (sym.y > boardHeight + 100) {
                            sym.y -= symbolHeight * needed;
                        }
                    });

                    elapsed += dist / scrollSpeed;
                }

                tempSymbols.forEach((sym) => sym.destroy());

                this.x = finalX;
                this.y = finalY;

                this.visible = true;
                gsap.fromTo(
                    this,
                    { y: finalY - 50 },
                    {
                        y: finalY,
                        ease: 'back.out(1.8)',
                        duration: 0.25,
                    },
                );

                this.unlock();
                resolve();
            });
        });
    }

    /** Play animation */
    public animatePlay(loop: boolean = false): Promise<void> {
        return new Promise((resolve) => {
            const process = ((this.parent as any)?.parent as any)?.__match3ProcessRef;

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

                // ✅ Trigger multiplier effect and WAIT for it on final resolve
                const multiplierDone = this.playMultiplierTriggerEffect();

                const listener = {
                    complete: () => {
                        this.spine.state.removeListener(listener);

                        if (loop && this._isLooping) {
                            playOnce(); // keep looping (do not block loop cadence)
                        } else {
                            this._isLooping = false;

                            // ✅ IMPORTANT: don't resolve until multiplier has landed too
                            multiplierDone.then(() => resolve());
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

        // ✅ Trigger multiplier effect and WAIT before resolve
        const multiplierDone = this.playMultiplierTriggerEffect();

        return new Promise((resolve) => {
            const listener = {
                complete: () => {
                    this.spine.state.removeListener(listener);

                    // ✅ wait multiplier too
                    multiplierDone.then(() => resolve());
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
        if (this.multiplierSprite) {
            resolveAndKillTweens(this.multiplierSprite);
        }
        if (this.multiplierTween) {
            this.multiplierTween.kill();
            this.multiplierTween = undefined;
        }
        if (this.multiplierTriggerTween) {
            this.multiplierTriggerTween.kill();
            this.multiplierTriggerTween = undefined;
        }

        // =========================================================
        // ✅ NEW: kill bonus tween too
        // =========================================================
        if (this.bonusSprite) {
            resolveAndKillTweens(this.bonusSprite);
        }
        if (this.bonusTween) {
            this.bonusTween.kill();
            this.bonusTween = undefined;
        }
        // =========================================================
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
        if (this.multiplierSprite) {
            pauseTweens(this.multiplierSprite);
        }

        // =========================================================
        // ✅ NEW: pause bonus
        // =========================================================
        if (this.bonusSprite) {
            pauseTweens(this.bonusSprite);
        }
        // =========================================================
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
        if (this.multiplierSprite) {
            resumeTweens(this.multiplierSprite);
        }

        // =========================================================
        // ✅ NEW: resume bonus
        // =========================================================
        if (this.bonusSprite) {
            resumeTweens(this.bonusSprite);
        }
        // =========================================================
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
        if (this.multiplierTriggerTween) {
            this.multiplierTriggerTween.kill();
            this.multiplierTriggerTween = undefined;
        }
        if (this.multiplierSprite) {
            this.removeChild(this.multiplierSprite);
            this.multiplierSprite.destroy();
            this.multiplierSprite = null;
        }

        // =========================================================
        // ✅ NEW: cleanup bonus
        // =========================================================
        if (this.bonusTween) {
            this.bonusTween.kill();
            this.bonusTween = undefined;
        }
        if (this.bonusSprite) {
            this.removeChild(this.bonusSprite);
            this.bonusSprite.destroy();
            this.bonusSprite = null;
        }
        // =========================================================

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
            this.multiplier === 2
                ? '2XMultiplier'
                : this.multiplier === 3
                  ? '3XMultiplier'
                  : this.multiplier === 5
                    ? '5XMultiplier'
                    : this.multiplier === 10
                      ? '10XMultiplier'
                      : null;

        if (!assetName) return;

        // Create sprite
        this.multiplierSprite = Sprite.from(assetName);
        this.multiplierSprite.anchor.set(0.5);
        this.multiplierSprite.scale.set(0.75);

        // Position BELOW the symbol (but still top layer visually)
        this.multiplierSprite.y = 40; // adjust to your icon height
        this.multiplierSprite.x = 0;

        // Add to top layer
        this.addChild(this.multiplierSprite);

        // Floating animation
        //this.applyMultiplierAnimation();
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
        this.multiplierTween = gsap
            .timeline({ repeat: 0 })
            .to(target, {
                alpha: 1,
                scale: 0.68,
                duration: 0.35,
                ease: 'back.out(1.8)',
            })
            .to(target, {
                y: baseY - 8,
                duration: 0.8,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
            });
    }

    /**
     * ✅ CLEAR behavior:
     * - While the multiplier is in the air (jumping up & coming down): it shakes.
     * - When it lands back to its original position: it shakes again (impact).
     *
     * ✅ NOW RETURNS Promise:
     * - So your spin gating can wait for multiplier to finish too.
     */
    private playMultiplierTriggerEffect(): Promise<void> {
        const target = this.multiplierSprite;
        if (!target) return Promise.resolve();
        if (this.multiplier === 0) return Promise.resolve();
        if (this.paused) return Promise.resolve();

        if (this.multiplierTriggerTween) {
            this.multiplierTriggerTween.kill();
            this.multiplierTriggerTween = undefined;
        }

        const baseY = target.y;
        const baseX = target.x;
        const baseRot = target.rotation;

        const jumpUpPx = 22;

        const airShakeX = 10;
        const airShakeRot = 0.1;
        const airShakeStep = 0.08;

        const landShakeX = 14;
        const landShakeRot = 0.14;
        const landShakeStep = 0.06;
        const landShakeRepeats = 6;

        const isTargetAlive = () => {
            return !!this.multiplierSprite && this.multiplierSprite === target && !target.destroyed;
        };

        const startAirShake = () => {
            if (!isTargetAlive()) return null;
            gsap.killTweensOf(target, 'x,rotation');
            return gsap.to(target, {
                x: baseX + airShakeX,
                rotation: baseRot + airShakeRot,
                duration: airShakeStep,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
            });
        };

        let airShakeTween: gsap.core.Tween | null = null;

        return new Promise((done) => {
            this.multiplierTriggerTween = gsap.timeline({
                repeat: 0,
                onComplete: () => {
                    if (airShakeTween) {
                        airShakeTween.kill();
                        airShakeTween = null;
                    }
                    if (isTargetAlive()) {
                        target.y = baseY;
                        target.x = baseX;
                        target.rotation = baseRot;
                    }
                    done();
                },
                onInterrupt: () => {
                    if (airShakeTween) {
                        airShakeTween.kill();
                        airShakeTween = null;
                    }
                    done();
                },
            });

            this.multiplierTriggerTween
                .add(() => {
                    if (!isTargetAlive()) return;
                    airShakeTween = startAirShake();
                })
                .to(target, { y: baseY - jumpUpPx, duration: 0.18, ease: 'power2.out' }, 0)
                .to(target, { y: baseY, duration: 0.22, ease: 'power2.in' })
                .add(() => {
                    if (airShakeTween) {
                        airShakeTween.kill();
                        airShakeTween = null;
                    }
                    if (!isTargetAlive()) return;
                    target.x = baseX;
                    target.rotation = baseRot;
                })
                .to(target, {
                    x: baseX + landShakeX,
                    rotation: baseRot + landShakeRot,
                    duration: landShakeStep,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: landShakeRepeats,
                })
                .to(target, {
                    x: baseX,
                    rotation: baseRot,
                    duration: 0.1,
                    ease: 'power2.out',
                });
        });
    }

    public getSpine() {
        return this.spine;
    }

    public stopAnimationImmediately() {
        this._isLooping = false;

        if (this.spine) {
            this.spine.state.clearTracks(); // remove all animations immediately
            this.spine.state.setEmptyAnimation(0, 0); // reset animation track
        }
    }

    public resetToSetupPose() {
        this._isLooping = false;
        if (!this.spine) return;

        // stop any running animation
        this.spine.state.clearTracks();

        // IMPORTANT: snap back to the original/default pose
        this.spine.skeleton.setToSetupPose();
        this.spine.skeleton.setSlotsToSetupPose();

        // apply + refresh transforms
        this.spine.state.apply(this.spine.skeleton);
        this.spine.skeleton.updateWorldTransform(Physics.update);
    }

    public showBlurSprite() {
        if (!this.sprite) {
            const assetName = 'blur_' + this.type.toString();

            const spr = Sprite.from(assetName);
            spr.anchor.set(0.5);
            spr.width = 150;
            spr.height = 180;
            spr.visible = false;
            this.sprite = spr;
            this.addChildAt(spr, 0);
        }

        // Hide spine
        if (this.spine) {
            this.spine.visible = false;
        }

        // Show PNG sprite
        if (this.sprite) {
            this.sprite.visible = true;
        }
    }

    public showSpine() {
        if (this.sprite) {
            this.sprite.visible = false;
        }
        if (this.spine) {
            this.spine.visible = true;
        }
    }

    public setType(type: number) {
        this.type = type;
    }

    public setBonusFlag(value: boolean) {
        this.bonus = value;
        this.updateBonusSprite();
    }

    /** Create or update bonus coin sprite */
    private updateBonusSprite() {
        // If bonus OFF -> remove sprite + kill tweens
        if (!this.bonus) {
            if (this.bonusTween) {
                this.bonusTween.kill();
                this.bonusTween = undefined;
            }
            if (this.bonusSprite) {
                this.removeChild(this.bonusSprite);
                this.bonusSprite.destroy();
                this.bonusSprite = null;
            }
            return;
        }

        // Bonus ON -> create if missing
        if (!this.bonusSprite) {
            // ✅ Change "coin" to your actual texture key
            this.bonusSprite = Sprite.from('bonus-coin');
            this.bonusSprite.anchor.set(0.5);

            // Put above everything else
            this.addChild(this.bonusSprite);
        }

        // Position at top-right corner of SlotSymbol container
        // (works best when your symbol visuals are centered around 0,0)
        const w = this.width || 120;
        const h = this.height || 150;

        this.bonusSprite.x = w * 0.5 - 40;
        this.bonusSprite.y = -h * 0.5 + 40;

        // Base size
        this.bonusSprite.scale.set(0.45);
        this.bonusSprite.alpha = 1;

        // Apply effect
        this.applyBonusEffect();
    }

    /** Slower zoom in/out, shake on zoom-in, with rest after zoom-out */
    private applyBonusEffect() {
        const target = this.bonusSprite;
        if (!target) return;
        if (this.paused) return;

        if (this.bonusTween) {
            this.bonusTween.kill();
            this.bonusTween = undefined;
        }

        const baseScale = 0.45;
        const bigScale = 0.62;
        const smallScale = 0.4;

        const baseX = target.x;
        const baseRot = target.rotation;

        // Clean start
        gsap.killTweensOf(target);
        gsap.killTweensOf(target.scale);
        target.scale.set(baseScale);
        target.x = baseX;
        target.rotation = baseRot;

        const tl = gsap.timeline({ repeat: -1 });

        // ─────────────────────────────────────────────
        // ZOOM IN (slower) + SHAKE DURING ZOOM-IN
        // ─────────────────────────────────────────────
        tl.to(
            target.scale,
            {
                x: bigScale,
                y: bigScale,
                duration: 0.28, // ⬅ slower zoom-in
                ease: 'back.out(1.8)',
            },
            0,
        ).to(
            target,
            {
                x: baseX + 3,
                rotation: baseRot + 0.08,
                duration: 0.06, // ⬅ slower shake steps
                ease: 'sine.inOut',
                yoyo: true,
                repeat: 4,
            },
            0,
        );

        // ─────────────────────────────────────────────
        // ZOOM OUT (slower, calm)
        // ─────────────────────────────────────────────
        tl.to(target.scale, {
            x: smallScale,
            y: smallScale,
            duration: 0.24,
            ease: 'power2.inOut',
        });

        // Reset transforms
        tl.to(target, {
            x: baseX,
            rotation: baseRot,
            duration: 0.12,
            ease: 'power2.out',
        });

        // Return to base size
        tl.to(target.scale, {
            x: baseScale,
            y: baseScale,
            duration: 0.16,
            ease: 'power2.out',
        });

        // ─────────────────────────────────────────────
        // REST / IDLE PAUSE (important!)
        // ─────────────────────────────────────────────
        tl.to({}, { duration: 0.6 }); // ⬅ rest time before looping again

        this.bonusTween = tl;
    }

    // =========================================================
}
