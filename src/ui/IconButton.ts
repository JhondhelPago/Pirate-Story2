import { FancyButton } from '@pixi/ui';
import { Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

const defaultIconButtonOptions = {
    icon: '',
    width: 80,
    height: 80,
    backgroundColor: 0x4a90e2,
    hoverColor: 0x5aa3f5,
    pressColor: 0x3a7bc8,
};

type IconButtonOptions = typeof defaultIconButtonOptions;

/**
 * Icon button with idle, hover, and pressed states
 */
export class IconButton extends FancyButton {
    /** The icon sprite displayed in the button */
    private iconSprite: Sprite;
    /** Original icon Y position */
    private iconBaseY: number = 0;

    constructor(options: Partial<IconButtonOptions> = {}) {
        const opts = { ...defaultIconButtonOptions, ...options };

        super({
            anchor: 0.5,
        });

        // Create icon sprite
        this.iconSprite = Sprite.from(opts.icon);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.y = this.iconBaseY;
        this.addChild(this.iconSprite);

        this.onDown.connect(this.handleDown.bind(this));
        this.onUp.connect(this.handleUp.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
        this.on('pointerupoutside', this.handleUp.bind(this));
        this.on('pointerout', this.handleOut.bind(this));
    }

    private handleHover() {
        sfx.play('common/sfx-hover.wav');

        // Scale up slightly
        gsap.killTweensOf(this.scale);
        gsap.to(this.scale, {
            x: 1.8,
            y: 1.8,
            duration: 0.2,
            ease: 'power2.out',
        });
    }

    private handleDown() {
        sfx.play('common/sfx-press.wav');

        // Scale down
        gsap.killTweensOf(this.scale);
        gsap.to(this.scale, {
            x: 1.2,
            y: 1.3,
            duration: 0.1,
            ease: 'power2.out',
        });

        // Move icon down
        this.iconSprite.y = this.iconBaseY + 4;
    }

    private handleUp() {
        gsap.killTweensOf(this.scale);
        gsap.to(this.scale, {
            x: 1.05,
            y: 1.05,
            duration: 0.1,
            ease: 'power2.out',
        });

        this.iconSprite.y = this.iconBaseY;
    }

    private handleOut() {
        gsap.killTweensOf(this.scale);
        gsap.to(this.scale, {
            x: 1.5,
            y: 1.5,
            duration: 0.2,
            ease: 'power2.out',
        });

        this.iconSprite.y = this.iconBaseY;
    }

    /** Show the component */
    public async show(animated = true) {
        gsap.killTweensOf(this.pivot);
        this.visible = true;
        if (animated) {
            this.pivot.y = -200;
            await gsap.to(this.pivot, { y: 0, duration: 0.5, ease: 'back.out' });
        } else {
            this.pivot.y = 0;
        }
        this.interactiveChildren = true;
    }

    /** Hide the component */
    public async hide(animated = true) {
        this.interactiveChildren = false;
        gsap.killTweensOf(this.pivot);
        if (animated) {
            await gsap.to(this.pivot, { y: -200, duration: 0.3, ease: 'back.in' });
        } else {
            this.pivot.y = -200;
        }
        this.visible = false;
    }
}
