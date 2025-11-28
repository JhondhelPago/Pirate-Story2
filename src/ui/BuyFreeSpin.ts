import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';
import { navigation } from '../utils/navigation';
import { BuyFreeSpinPopup } from '../popups/BuyFreeSpinPopup';

/**
 * Simplified Buy Free Spin button using ONE sprite asset.
 */
export class BuyFreeSpin extends Container {
    /** Inner container (type-safe so existing code still works) */
    private container: Container;
    /** The only image for the button */
    private button: Sprite;

    constructor() {
        super();

        // Keep inner container so structure stays compatible
        this.container = new Container();
        this.addChild(this.container);

        // Load your single PNG asset
        this.button = Sprite.from('scroll-map');
        this.button.anchor.set(0.5);
        this.container.addChild(this.button);

        // Enable interaction
        this.setupInteractivity();

        // 👉 CLICK TO OPEN POPUP
        this.on('pointertap', () => {
            navigation.presentPopup(BuyFreeSpinPopup, {
                onSelect: (value: number) => {
                    console.log("Selected Buy Free Spins:", value);

                    // ⭐ place your buy logic here
                    // you can call API, start free spins, etc.
                }
            });
        });
    }

    /** Setup hover & press interactions */
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

    /** Show button */
    public async show(animated = true) {
        this.visible = true;
        this.eventMode = 'static';

        gsap.killTweensOf(this.container);

        if (animated) {
            this.container.alpha = 0;
            this.container.scale.set(1.5);

            gsap.to(this.container, { alpha: 1, duration: 0.3 });
            await gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
        } else {
            this.container.alpha = 1;
            this.container.scale.set(1);
        }
    }

    /** Hide button */
    public async hide(animated = true) {
        this.eventMode = 'none';

        gsap.killTweensOf(this.container);

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
