import { FancyButton } from '@pixi/ui';
import { Sprite } from 'pixi.js';
import gsap from 'gsap';
import { Label } from './Label';
import { sfx } from '../utils/audio';

const defaultButtonOptions = {
    text: '',
    width: 472,
    height: 72,
    fontSize: 28,
};

type ButtonOptions = typeof defaultButtonOptions;

/**
 * The big rectangle button, with a label, idle and pressed states
 */
export class Button extends FancyButton {
    /** The buttoon message displayed */
    private messageLabel: Label;

    constructor(options: Partial<ButtonOptions> = {}) {
        const opts = { ...defaultButtonOptions, ...options };

        const defaultView = Sprite.from('button-default-view');
        defaultView.width = opts.width;
        defaultView.height = opts.height;

        const hoverView = Sprite.from('button-active-view');
        hoverView.width = opts.width;
        hoverView.height = opts.height;

        const pressedView = Sprite.from('button-active-view');
        pressedView.width = opts.width;
        pressedView.height = opts.height;

        super({
            defaultView,
            hoverView,
            pressedView,
            anchor: 0.5,
        });

        this.messageLabel = new Label(opts.text, {
            fill: 0xffffff,
            align: 'center',
            fontSize: opts.fontSize,
        });
        this.addChild(this.messageLabel);

        this.onDown.connect(this.handleDown.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
    }

    private handleHover() {
        sfx.play('common/sfx-hover.wav');
    }

    private handleDown() {
        sfx.play('common/sfx-press.wav');
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

    public setText(text: string) {
        this.messageLabel.text = text;
    }
}
