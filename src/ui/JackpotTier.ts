import { Container, FillGradient, Sprite, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import { throttle } from '../utils/throttle';
import { sfx } from '../utils/audio';
import { Label } from './Label';

const defaultJackpotTierOptions = {
    name: 'multiplier_label_grand',
    tier: 'frame_multiplier_grand',
    dotActive: 'multiplier_bullet_grand',
    dotInactive: 'multiplier_bullet_outline',
    points: 0,
    totalDots: 0,
    totalOccurance: 0,
    currency: '$',
    activeDots: 0,
};

export type JackpotTierOptions = typeof defaultJackpotTierOptions;

/**
 * The game multiplier display with animated score and dot indicators
 */
export class JackpotTier extends Container {
    /** Inner container for animation */
    private container: Container;
    /** The frame background */
    private frame: Sprite;
    /** The label sprite at the top */
    private frameLabel: Sprite;
    /** The multiplier value text */
    private messageLabel: Label;
    /** Container for dot indicators */
    private dotsContainer: Container;
    /** Array of dot sprites */
    private dots: Sprite[] = [];
    /** Occurance */
    private occuranceLabel: Label;

    /** Configuration */
    private readonly config: Required<JackpotTierOptions>;

    /** State */
    private totalOccurance: number;
    private totalDots: number;
    private activeDots: number;
    private currency: String;
    private points = -1;
    private showing = true;
    private intensity = 0;

    constructor(options: Partial<JackpotTierOptions> = {}) {
        super();

        // Merge options with defaults
        this.config = { ...defaultJackpotTierOptions, ...options };
        this.currency = this.config.currency;
        this.points = this.config.points;
        this.totalOccurance = this.config.totalOccurance;
        this.totalDots = this.config.totalDots;
        this.activeDots = this.config.activeDots;

        // Setup UI
        this.container = new Container();
        this.addChild(this.container);

        // Setup frame and label
        this.frame = Sprite.from(this.config.tier);
        this.frame.anchor.set(0.5);
        this.frame.scale.set(0.5);
        this.container.addChild(this.frame);

        this.frameLabel = Sprite.from(this.config.name);
        this.frameLabel.anchor.set(0.5);
        this.frameLabel.y = -60;
        this.frameLabel.scale.set(0.5);
        this.container.addChild(this.frameLabel);

        // Setup multiplier label
        const verticalGradient = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#fff3ce' },
                { offset: 1, color: '#e0a114' },
            ],
            textureSpace: 'local',
        });

        const style = new TextStyle({
            fontFamily: 'Spartanmb Bold',
            fontSize: 50,
            stroke: {
                width: 3,
                color: '#000000',
            },
            dropShadow: {
                alpha: 1,
                angle: Math.PI / 2,
                blur: 0,
                color: '#000000',
                distance: 4,
            },
        });

        this.messageLabel = new Label(`${this.currency}${this.config.points}`, style);
        this.messageLabel.style.fill = verticalGradient;
        this.container.addChild(this.messageLabel);
        this.fitTextToContainer();

        this.occuranceLabel = new Label(`x10`, style);
        this.occuranceLabel.style.fill = verticalGradient;
        this.occuranceLabel.x = 220;
        this.occuranceLabel.alpha = 0;
        this.container.addChild(this.occuranceLabel);

        // Setup dots container
        this.dotsContainer = new Container();
        this.dotsContainer.y = 55;
        this.container.addChild(this.dotsContainer);

        this.createDots();
        this.points = 0;
    }

    /** Create dot indicators */
    private createDots() {
        // Clear existing dots
        this.dotsContainer.removeChildren();
        this.dots = [];

        if (this.totalDots === 0) return;

        const DOT_SPACING = 26;
        const DOT_SCALE = 0.5;
        const DOT_Y_OFFSET = -10;

        const totalWidth = (this.totalDots - 1) * DOT_SPACING;
        const startX = -totalWidth / 2;

        for (let i = 0; i < this.totalDots; i++) {
            const dot = Sprite.from(this.config.dotInactive);
            dot.anchor.set(0.5);
            dot.x = startX + i * DOT_SPACING;
            dot.y = DOT_Y_OFFSET;
            dot.scale.set(DOT_SCALE);

            this.dotsContainer.addChild(dot);
            this.dots.push(dot);
        }

        this.updateDots();
    }

    /** Update dot visual states based on active count */
    private updateDots() {
        for (let i = 0; i < this.dots.length; i++) {
            const dot = this.dots[i];
            const isActive = i < this.activeDots;

            const textureName = isActive ? this.config.dotActive : this.config.dotInactive;
            dot.texture = Sprite.from(textureName).texture;
        }
    }

    /** Animate a specific dot when it becomes active */
    private animateDot(index: number) {
        if (index < 0 || index >= this.dots.length) return;

        const dot = this.dots[index];
        gsap.killTweensOf(dot.scale);
        dot.scale.set(0.3);
        gsap.to(dot.scale, {
            x: 0.5,
            y: 0.5,
            duration: 0.3,
            ease: 'back.out(2)',
        });
    }

    /** Fit text to container by scaling down if needed */
    private fitTextToContainer() {
        // Get the frame width as the maximum allowed width
        const maxWidth = this.frame.width * 0.8; // 80% of frame width for padding
        const textWidth = this.messageLabel.width;

        if (textWidth > maxWidth) {
            // Scale down proportionally to fit
            const scale = maxWidth / textWidth;
            this.messageLabel.scale.set(scale);
        } else {
            // Reset to original scale if text fits
            this.messageLabel.scale.set(1);
        }
    }

    /** Set the total number of dots */
    public setTotalDots(total: number) {
        if (this.totalDots === total || total < 0) return;

        this.totalDots = total;
        this.activeDots = Math.min(this.activeDots, total);
        this.createDots();
    }

    /** Set the number of active dots with optional animation */
    public setActiveDots(active: number, animated = true) {
        const newOccurrence = Math.floor(active / this.totalDots);
        const activeInSet = active % this.totalDots; // Remainder after full sets
        const clampedActive = Math.max(0, Math.min(activeInSet, this.totalDots));

        // Check if both dots AND occurrence are unchanged
        if (this.activeDots === clampedActive && this.totalOccurance === newOccurrence) return;

        const previousActive = this.activeDots;
        const previousOccurrence = this.totalOccurance;

        this.activeDots = clampedActive;
        this.totalOccurance = newOccurrence;
        this.updateDots();

        // Only animate occurrence label if it changed
        if (this.totalOccurance > 0 && this.totalOccurance !== previousOccurrence) {
            this.occuranceLabel.text = `x${this.totalOccurance}`;

            // Kill any existing tweens
            gsap.killTweensOf(this.occuranceLabel);
            gsap.killTweensOf(this.occuranceLabel.scale);

            // Set initial state
            this.occuranceLabel.alpha = 0;
            this.occuranceLabel.scale.set(0.5);

            // Animate in with scale and fade
            gsap.to(this.occuranceLabel, {
                alpha: 1,
                duration: 0.3,
                ease: 'back.out(2)',
            });

            gsap.to(this.occuranceLabel.scale, {
                x: 1,
                y: 1,
                duration: 0.3,
                ease: 'back.out(2)',
            });

            // Hide the label after 2 seconds
            gsap.to(this.occuranceLabel, {
                alpha: 0,
                duration: 0.5,
                delay: 4.3,
                ease: 'power2.out',
            });
        }

        // Animate the newly activated dot
        if (animated && clampedActive > previousActive) {
            this.animateDot(clampedActive - 1);
        }
    }

    /** Get the current number of active dots */
    public getActiveDots(): number {
        return this.activeDots;
    }

    /** Get the total number of dots */
    public getTotalDots(): number {
        return this.totalDots;
    }

    /** Reset score to 0 */
    public reset() {
        this.points = 0;
        this.messageLabel.text = '0';
        this.messageLabel.scale.set(1);
        this.intensity = 0;
    }

    /** Set the score and play the points animation */
    public set amount(value: number) {
        if (this.points === value) return;
        this.points = value;
        this.printPoints();
    }

    /** Show the component */
    public async show(animated = true) {
        if (this.showing) return;

        this.showing = true;
        this.visible = true;

        gsap.killTweensOf(this.container.scale);

        if (animated) {
            this.container.scale.set(0);
            await gsap.to(this.container.scale, {
                x: 1,
                y: 1,
                duration: 0.3,
                ease: 'back.out',
            });
        } else {
            this.container.scale.set(1);
        }
    }

    /** Hide the component */
    public async hide(animated = true) {
        if (!this.showing) return;

        this.showing = false;
        gsap.killTweensOf(this.container.scale);

        if (animated) {
            await gsap.to(this.container.scale, {
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'back.in',
            });
        }

        this.visible = false;
    }

    /** Update displayed points and play sound */
    private printPoints() {
        const text = `${this.currency}${this.points}`;

        if (this.messageLabel.text === text) return;

        this.messageLabel.text = text;
        this.fitTextToContainer();

        const speed = Math.min(0.8 + this.intensity * 0.001, 2);
        throttle('score', 100, () => {
            sfx.play('common/sfx-points.wav', { speed, volume: 0.2 });
        });
    }

    /** Clean up animations */
    public destroy() {
        gsap.killTweensOf(this);
        gsap.killTweensOf(this.container.scale);
        this.dots.forEach((dot) => gsap.killTweensOf(dot.scale));
        super.destroy();
    }
}
