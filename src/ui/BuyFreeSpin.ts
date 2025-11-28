import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';
import { navigation } from '../utils/navigation';
import { BuyFreeSpinPopup } from '../popups/BuyFreeSpinPopup';

export class BuyFreeSpin extends Container {
    private floatWrapper: Container;   // NEW LAYER
    private container: Container;      // Your original container
    private button: Sprite;

    private floatTimeline?: gsap.core.Timeline;

    constructor() {
        super();

        // --------------------------
        // FLOAT WRAPPER (Moves up/down)
        // --------------------------
        this.floatWrapper = new Container();
        this.addChild(this.floatWrapper);

        // --------------------------
        // MAIN UI CONTAINER (Scales on hover)
        // --------------------------
        this.container = new Container();
        this.floatWrapper.addChild(this.container);

        // --------------------------
        // BUTTON IMAGE
        // --------------------------
        this.button = Sprite.from('scroll-map');
        this.button.anchor.set(0.5);
        this.container.addChild(this.button);

        this.setupInteractivity();

        // OPEN POPUP
        this.on('pointertap', () => {
            navigation.presentPopup(BuyFreeSpinPopup, {
                onSelect: (value: number) => {
                    console.log("Selected Buy Free Spins:", value);
                }
            });
        });
    }

    // -------------------------------
    // INTERACTION HANDLERS
    // -------------------------------
    private setupInteractivity() {
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerover', () => this.handleHover());
        this.on('pointerout', () => this.handleOut());
        this.on('pointerdown', () => this.handleDown());
    }

    private handleHover() {
        sfx.play('common/sfx-hover.wav');

        gsap.killTweensOf(this.container.scale);
        gsap.to(this.container.scale, { x: 1.05, y: 1.05, duration: 0.2, ease: 'back.out' });
    }

    private handleOut() {
        gsap.killTweensOf(this.container.scale);
        gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out' });
    }

    private handleDown() {
        sfx.play('common/sfx-press.wav');

        gsap.killTweensOf(this.container.scale);

        gsap.to(this.container.scale, { x: 0.95, y: 0.95, duration: 0.1, ease: 'power2.out' });
        gsap.to(this.container.scale, { x: 1.05, y: 1.05, duration: 0.2, delay: 0.1, ease: 'back.out' });
    }

    // -------------------------------
    // FLOAT ANIMATION (NOW WORKS 100%)
    // -------------------------------
    private startFloating() {
        if (this.floatTimeline) return; // already running

        this.floatTimeline = gsap.timeline({ repeat: -1, yoyo: true });

        this.floatTimeline.to(this.floatWrapper, {
            y: -10,
            duration: 1.6,
            ease: "sine.inOut",
        });
    }

    private stopFloating() {
        if (this.floatTimeline) {
            this.floatTimeline.kill();
            this.floatTimeline = undefined;
        }
        this.floatWrapper.y = 0; // reset to original
    }

    // -------------------------------
    // SHOW / HIDE WITH FLOATING
    // -------------------------------
    public async show(animated = true) {
        this.visible = true;
        this.eventMode = 'static';

        this.stopFloating();

        if (animated) {
            this.container.alpha = 0;
            this.container.scale.set(1.5);

            gsap.to(this.container, { alpha: 1, duration: 0.3 });
            await gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
        } else {
            this.container.alpha = 1;
            this.container.scale.set(1);
        }

        // ⭐ NOW FLOATS CORRECTLY
        this.startFloating();
    }

    public async hide(animated = true) {
        this.eventMode = 'none';

        this.stopFloating();

        if (animated) {
            gsap.to(this.container, { alpha: 0, duration: 0.3 });
            await gsap.to(this.container.scale, { x: 1.5, y: 1.5, duration: 0.3, ease: 'back.in' });
        } else {
            this.container.alpha = 0;
            this.container.scale.set(0);
        }

        this.visible = false;
    }
}
