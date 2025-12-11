import { ButtonContainer } from '@pixi/ui';
import { Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';

const defaultSpinButtonOptions = {
    width: 170,
    height: 170,
};

type SpinButtonOptions = typeof defaultSpinButtonOptions;

export enum SpinButtonState {
    PLAY = 'play',
    STOP = 'stop',
}

/**
 * The big rectangle button with play/stop toggle functionality
 */
export class SpinButton extends ButtonContainer {
    /** Current state of the button */
    private currentState: SpinButtonState = SpinButtonState.PLAY;
    /** Button view sprite */
    private buttonView: Sprite;
    /** Button dimensions */
    private buttonWidth: number;
    private buttonHeight: number;

    constructor(options: Partial<SpinButtonOptions> = {}) {
        super();

        const opts = { ...defaultSpinButtonOptions, ...options };

        this.buttonWidth = opts.width;
        this.buttonHeight = opts.height;

        // Create button view
        this.buttonView = Sprite.from('icon-button-spin-default-view');
        this.buttonView.anchor.set(0.5);
        this.buttonView.width = opts.width;
        this.buttonView.height = opts.height;
        this.addChild(this.buttonView);

        // Add event listeners
        this.onDown.connect(this.handleDown.bind(this));
        this.onHover.connect(this.handleHover.bind(this));
        this.onOut.connect(this.handleOut.bind(this));

        // Set initial state
        this.setState(SpinButtonState.PLAY);
    }

    private handleHover() {
        sfx.play('common/sfx-hover.wav');
    }

    private handleOut() {
        // Optional: add hover out effect
    }

    private handleDown() {
        sfx.play('common/sfx-press.wav');
    }

    /** Set the button state (play or stop) */
    public setState(state: SpinButtonState) {
        this.currentState = state;
        this.updateView();
    }

    /** Get the current button state */
    public getState(): SpinButtonState {
        return this.currentState;
    }

    /** Toggle between play and stop states */
    public toggleState() {
        const newState = this.currentState === SpinButtonState.PLAY ? SpinButtonState.STOP : SpinButtonState.PLAY;
        this.setState(newState);
    }

    /** Update button view based on current state */
    private updateView() {
        if (this.currentState === SpinButtonState.PLAY) {
            this.buttonView.texture = Texture.from('icon-button-spin-default-view');
        } else {
            this.buttonView.texture = Texture.from('icon-button-spin-stop-view');
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
