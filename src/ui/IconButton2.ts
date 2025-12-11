import { FancyButton } from '@pixi/ui';
import { Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

const defaultIconButtonOptions = {
    imageDefault: '',
    imageHover: '',
    imagePressed: '',
    imageDisabled: '',
    width: 150,
    height: 150,
};

type IconButtonOptions = typeof defaultIconButtonOptions;

/**
 * The big rectangle button, with a label, idle and pressed states
 */
export class IconButton extends FancyButton {
    constructor(options: Partial<IconButtonOptions> = {}) {
        const opts = { ...defaultIconButtonOptions, ...options };

        const defaultView = Sprite.from(opts.imageDefault);
        const disabledView = Sprite.from(opts.imageDisabled);
        const hoverView = Sprite.from(opts.imageHover);
        const pressedView = Sprite.from(opts.imagePressed);

        super({
            disabledView,
            defaultView,
            hoverView,
            pressedView,
            anchor: 0.5,
        });

        this.onDown.connect(this.handleDown.bind(this));
        this.onUp.connect(this.handleUp.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
        this.on('pointerupoutside', this.handleUp.bind(this));
        this.on('pointerout', this.handleUp.bind(this));
    }

    private handleHover() {
        sfx.play('common/sfx-hover.wav');
    }

    private handleDown() {
        sfx.play('common/sfx-press.wav');
    }

    private handleUp() {
        // Handle up
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
