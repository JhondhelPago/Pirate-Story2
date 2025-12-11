import { FancyButton } from '@pixi/ui';
import { Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

const defaultToggleIconButtonOptions = {
    imageDefaultOn: '',
    imageHoverOn: '',
    imagePressedOn: '',
    imageDisabledOn: '',
    imageDefaultOff: '',
    imageHoverOff: '',
    imagePressedOff: '',
    imageDisabledOff: '',
    width: 150,
    height: 150,
};

type ToggleIconButtonOptions = typeof defaultToggleIconButtonOptions;

/**
 * A toggleable icon button that switches between two states
 */
export class ToggleIconButton extends FancyButton {
    private defaultViewOn: Sprite;
    private hoverViewOn: Sprite;
    private pressedViewOn: Sprite;
    private disabledViewOn: Sprite;

    private defaultViewOff: Sprite;
    private hoverViewOff: Sprite;
    private pressedViewOff: Sprite;
    private disabledViewOff: Sprite;

    private _isOn: boolean = true;

    constructor(options: Partial<ToggleIconButtonOptions> = {}) {
        const opts = { ...defaultToggleIconButtonOptions, ...options };

        // Create ON state sprites
        const defaultViewOn = Sprite.from(opts.imageDefaultOn);
        const hoverViewOn = Sprite.from(opts.imageHoverOn);
        const pressedViewOn = Sprite.from(opts.imagePressedOn);
        const disabledViewOn = Sprite.from(opts.imageDisabledOn);

        super({
            defaultView: defaultViewOn,
            hoverView: hoverViewOn,
            pressedView: pressedViewOn,
            disabledView: disabledViewOn,
            anchor: 0.5,
        });

        // Store ON state sprites
        this.defaultViewOn = defaultViewOn;
        this.hoverViewOn = hoverViewOn;
        this.pressedViewOn = pressedViewOn;
        this.disabledViewOn = disabledViewOn;

        // Create OFF state sprites
        this.defaultViewOff = Sprite.from(opts.imageDefaultOff);
        this.hoverViewOff = Sprite.from(opts.imageHoverOff);
        this.pressedViewOff = Sprite.from(opts.imagePressedOff);
        this.disabledViewOff = Sprite.from(opts.imageDisabledOff);

        this.onDown.connect(this.handleDown.bind(this));
        this.onUp.connect(this.handleUp.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
        this.on('pointerupoutside', this.handleUp.bind(this));
        this.on('pointerout', this.handleUp.bind(this));
    }

    /**
     * Toggle between on and off states
     */
    public toggle() {
        this.setToggleState(!this._isOn);
    }

    /**
     * Set the toggle state
     */
    public setToggleState(isOn: boolean) {
        this._isOn = isOn;

        if (isOn) {
            this.defaultView = this.defaultViewOn;
            this.hoverView = this.hoverViewOn;
            this.pressedView = this.pressedViewOn;
            this.disabledView = this.disabledViewOn;
        } else {
            this.defaultView = this.defaultViewOff;
            this.hoverView = this.hoverViewOff;
            this.pressedView = this.pressedViewOff;
            this.disabledView = this.disabledViewOff;
        }

        // Force visual update by toggling enabled state
        const wasEnabled = this.enabled;
        this.enabled = !wasEnabled;
        this.enabled = wasEnabled;
    }

    /**
     * Get current toggle state
     */
    public get isOn(): boolean {
        return this._isOn;
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
