import { ButtonContainer } from '@pixi/ui';
import { Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

const defaultAutoplayButtonOptions = {
    width: 50,
    height: 50,
};

type AutoplayButtonOptions = typeof defaultAutoplayButtonOptions;

export enum AutoplayButtonState {
    DISABLED = 'disabled',
    ENABLED = 'enabled',
    AUTOPLAY = 'autoplay',
}

/**
 * The big rectangle button with play/stop toggle functionality
 */
export class AutoplayButton extends ButtonContainer {
    /** Current state of the button */
    private currentState: AutoplayButtonState = AutoplayButtonState.ENABLED;
    /** Button view sprite */
    private buttonView: Sprite;
    /** Button dimensions */
    private buttonWidth: number;
    private buttonHeight: number;

    constructor(options: Partial<AutoplayButtonOptions> = {}) {
        super();

        const opts = { ...defaultAutoplayButtonOptions, ...options };

        this.buttonWidth = opts.width;
        this.buttonHeight = opts.height;

        // Create button view
        this.buttonView = Sprite.from('icon-button-autoplay-default-view');
        this.buttonView.anchor.set(0.5);
        this.buttonView.width = opts.width;
        this.buttonView.height = opts.height;
        this.addChild(this.buttonView);

        // Add event listeners
        this.onDown.connect(this.handleDown.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
        this.onOut.connect(this.handleOut.bind(this));

        // Set initial state
        this.setState(AutoplayButtonState.ENABLED);
    }

    private handleHover() {
        sfx.play('audio/sfx-hover.wav');
    }

    private handleOut() {
        // Optional: add hover out effect
    }

    private handleDown() {
        sfx.play('audio/sfx-press.wav');
    }

    /** Set the button state (play or stop) */
    public setState(state: AutoplayButtonState) {
        this.currentState = state;
        this.updateView();
    }

    /** Get the current button state */
    public getState(): AutoplayButtonState {
        return this.currentState;
    }

    /** Update button view based on current state */
    private updateView() {
        if (this.currentState === AutoplayButtonState.ENABLED) {
            this.enabled = true;
            this.buttonView.texture = Texture.from('icon-button-autoplay-default-view');
        } else if (this.currentState == AutoplayButtonState.DISABLED) {
            this.enabled = false;
            this.buttonView.texture = Texture.from('icon-button-autoplay-disabled-view');
        } else {
            this.enabled = true;
            this.buttonView.texture = Texture.from('icon-button-autoplay-playing-view');
        }

        // Ensure dimensions are maintained
        this.buttonView.width = this.buttonWidth;
        this.buttonView.height = this.buttonHeight;
    }

    /** Show the component */
    public async show(animated = true) {
        gsap.killTweensOf(this);
        this.visible = true;
        if (animated) {
            this.y = -200;
            await gsap.to(this, { y: 0, duration: 0.5, ease: 'back.out' });
        } else {
            this.y = 0;
        }
        this.enabled = true;
    }

    /** Hide the component */
    public async hide(animated = true) {
        this.enabled = false;
        gsap.killTweensOf(this);
        if (animated) {
            await gsap.to(this, { y: -200, duration: 0.3, ease: 'back.in' });
        } else {
            this.y = -200;
        }
        this.visible = false;
    }
}
