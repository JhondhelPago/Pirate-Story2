import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

export class PlayButton extends Container {
    private shield: Sprite;
    private play: Sprite;

    private isHovering = false;
    private clickCallback?: () => void;

    /** Speed multiplier for the wheel spin */
    public spinSpeed = 2;

    /** GSAP infinite timeline */
    private spinTimeline?: gsap.core.Tween;

    constructor() {
        super();

        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.shield = Sprite.from('wheel');
        this.shield.anchor.set(0.5);
        this.addChild(this.shield);

        this.play = Sprite.from('play');
        this.play.anchor.set(0.5);
        this.play.scale.set(1.2);
        this.play.x += 10;
        this.addChild(this.play);

        this.on('pointerover', this.onHover.bind(this));
        this.on('pointerout', this.onOut.bind(this));
        this.on('pointerdown', this.onPress.bind(this));
        this.on('pointerup', this.onRelease.bind(this));
    }

    // --------------------------------------------------------
    // HOVER
    // --------------------------------------------------------
    private onHover() {
        if (this.spinTimeline) return; // ignore hover while spinning

        this.isHovering = true;
        sfx.play('common/sfx-hover.wav');

        gsap.killTweensOf(this.shield);

        gsap.to(this.shield, {
            rotation: Math.PI / 2,
            duration: 0.35,
            ease: 'power2.out',
        });

        gsap.to(this.play.scale, {
            x: 1.32,
            y: 1.32,
            duration: 0.25,
            ease: 'power2.out',
        });
    }

    // --------------------------------------------------------
    // HOVER OUT
    // --------------------------------------------------------
    private onOut() {
        if (this.spinTimeline) return; // ignore hover-out while spinning

        this.isHovering = false;

        gsap.to(this.shield, {
            rotation: 0,
            duration: 0.35,
            ease: 'power2.out',
        });

        gsap.to(this.play.scale, {
            x: 1,
            y: 1,
            duration: 0.25,
            ease: 'power2.out',
        });
    }

    // --------------------------------------------------------
    // PRESS
    // --------------------------------------------------------
    private onPress() {
        sfx.play('common/sfx-press.wav');

        gsap.to(this.play.scale, {
            x: 0.1,
            y: 0.1,
            duration: 0.15,
            ease: 'power2.out',
        });
    }

    // --------------------------------------------------------
    // RELEASE (CLICK)
    // --------------------------------------------------------
    private onRelease() {
        // Stop hover effect and lock state
        this.isHovering = false;

        // Kill any ongoing tweens
        gsap.killTweensOf(this.shield);

        // Start infinite spinning
        this.spinTimeline = gsap.to(this.shield, {
            rotation: "+=" + (Math.PI * 2),
            duration: 1 / this.spinSpeed, // speed multiplier
            ease: 'none',
            repeat: -1,
        });

        // Return icon scale to normal
        gsap.to(this.play.scale, {
            x: 1.2,
            y: 1.2,
            duration: 0.15,
            ease: 'power2.out',
        });

        // After 1.5 seconds → go to next screen
        setTimeout(() => {
            if (this.spinTimeline) {
                this.spinTimeline.kill();
                this.spinTimeline = undefined;
            }

            if (this.clickCallback) this.clickCallback();
        }, 500);
    }

    /** Register callback after spin completes (1.5s) */
    public onClick(callback: () => void) {
        this.clickCallback = callback;
    }
}
