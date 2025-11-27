import { Container, Texture, AnimatedSprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { resolveAndKillTweens, registerCustomEase, pauseTweens, resumeTweens } from '../utils/animation';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

/** Default piece options */
const defaultSlotSymbolOptions = {
    name: '',
    type: 0,
    size: 50,
    interactive: false,
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
                fill: '#00ff00ff',
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

        // Create new spine animation
        this.spine = Spine.from({
            skeleton: `game/${opts.name}.json`,
            atlas: `game/${opts.name}.atlas`,
        });

        // Center the spine
        this.spine.x = 0;
        this.spine.y = 0;

        // Scale to match size
        this.spine.pivot.set(0.5);
        this.spine.scale.set(0.45);

        // Add spine to display (behind explosion)
        this.addChildAt(this.spine, 0);

        // Size explosion to match piece
        if (this.explosionSprite) {
            this.explosionSprite.width = opts.size;
            this.explosionSprite.height = opts.size;
            this.explosionSprite.visible = false;
        }

        this.textLabel.text = this.type;
        this.addChild(this.textLabel);

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

    /** Play animation */
    public async animatePlay(): Promise<void> {
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
        if (this.spine) {
            this.spine.destroy();
        }
        if (this.explosionSprite) {
            this.explosionSprite.destroy();
        }
        super.destroy();
    }
}
