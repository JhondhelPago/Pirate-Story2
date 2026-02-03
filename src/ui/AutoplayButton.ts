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

    /**
     * Override mode:
     * - null => normal state-based textures
     * - 'cancel' / 'disabled' => force that texture
     */
    private overrideView: 'cancel' | 'disabled' | null = null;

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

    /**
     * Show cancel (red) asset BUT keep it interactive like default.
     * This only swaps the texture; it does NOT force-disable the button.
     */
    public showCancelView() {
        this.overrideView = 'cancel';

        // keep interaction like default state:
        // - if your currentState is DISABLED, keep it disabled
        // - otherwise keep it enabled (interactive)
        this.updateInteractivityFromState();

        this.buttonView.texture = Texture.from('icon-button-autoplay-cancel-view');
        this.applySize();
    }

    /**
     * Show disabled asset and force-disable interactivity.
     * (Your current behavior is correct per your note.)
     */
    public showDisabledView() {
        this.overrideView = 'disabled';

        // force non-interactive
        this.enabled = false;

        this.buttonView.texture = Texture.from('icon-button-autoplay-disabled-view');
        this.applySize();
    }

    /** Restore normal state-based asset */
    public restoreDefaultView() {
        this.overrideView = null;
        this.updateView();
    }

    /** Update button view based on current state */
    private updateView() {
        // If overridden, only apply the override behavior
        if (this.overrideView === 'cancel') {
            // keep interactivity like default
            this.updateInteractivityFromState();
            this.buttonView.texture = Texture.from('icon-button-autoplay-cancel-view');
            this.applySize();
            return;
        }

        if (this.overrideView === 'disabled') {
            this.enabled = false;
            this.buttonView.texture = Texture.from('icon-button-autoplay-disabled-view');
            this.applySize();
            return;
        }

        // Normal (not overridden): state-based textures + interactivity
        if (this.currentState === AutoplayButtonState.ENABLED) {
            this.enabled = true;
            this.buttonView.texture = Texture.from('icon-button-autoplay-default-view');
        } else if (this.currentState === AutoplayButtonState.DISABLED) {
            this.enabled = false;
            this.buttonView.texture = Texture.from('icon-button-autoplay-disabled-view');
        } else {
            this.enabled = true;
            this.buttonView.texture = Texture.from('icon-button-autoplay-playing-view');
        }

        this.applySize();
    }

    /**
     * Keep interaction in-sync with the current state (default behavior),
     * WITHOUT forcing disabled just because we changed the texture.
     */
    private updateInteractivityFromState() {
        this.enabled = this.currentState !== AutoplayButtonState.DISABLED;
    }

    private applySize() {
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

        // Respect overrides/state when showing
        this.updateView();
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
