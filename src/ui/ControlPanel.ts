import { Container, Text, Sprite, Texture } from 'pixi.js';
import { IconButton } from './IconButton2';
import { userSettings } from '../utils/userSettings';
import { MatchPattern } from './MatchPattern';
import { AudioButton } from './AudioButton';
import { SpinButton, SpinButtonState } from './SpinButton';
import { LabelValue } from './LabelValue';
import { BetAPI } from '../api/betApi';

export interface WinMatchPattern {
    times: number;
    type: number;
    amount: number;
    currency: string;
}

/**
 * Control panel for the game, displaying credit, bet info, and action buttons
 */
export class ControlPanel extends Container {
    private background: Sprite;
    private contentContainer: Container;
    private creditDisplay: LabelValue;
    private betDisplay: LabelValue;
    private titleText: Text;
    private messageText: Text;
    private matchPattern: MatchPattern;
    private winMatchPatterns: WinMatchPattern[] = [];

    public audioButton: AudioButton;
    private infoButton: IconButton;
    private settingsButton: IconButton;
    private minusButton: IconButton;
    private spinButton: SpinButton;
    private plusButton: IconButton;
    private autoplayButton: IconButton;

    private panelHeight = 160;
    private contentWidth = 1920;

    private currency = 'usd';
    private shouldStopMatches = false;

    private spacebarHandler?: (e: KeyboardEvent) => void;

    constructor() {
        super();

        this.currency = userSettings.getCurrency();

        // Create semi-transparent background using Sprite
        this.background = Sprite.from(Texture.WHITE);
        this.background.tint = 0x000000;
        this.background.alpha = 0.7;
        this.addChild(this.background);

        // Create content container with max width
        this.contentContainer = new Container();
        this.addChild(this.contentContainer);

        // Credit display
        this.creditDisplay = new LabelValue({
            labelText: 'CREDIT',
            fontSize: 22,
            align: 'left',
        });
        this.creditDisplay.setValue(userSettings.getBalance(), this.currency);
        this.contentContainer.addChild(this.creditDisplay);

        // Bet display
        this.betDisplay = new LabelValue({
            labelText: 'BET',
            fontSize: 22,
            align: 'left',
        });
        this.betDisplay.setValue(userSettings.getBet(), this.currency);
        this.contentContainer.addChild(this.betDisplay);

        // Center message
        this.titleText = new Text({
            text: 'HOLD SPACE FOR TURBO SPIN',
            style: {
                fontSize: 32,
                fill: 0xffd700,
                fontWeight: 'bold',
            },
        });
        this.titleText.anchor.set(0.5, 0.75);
        this.contentContainer.addChild(this.titleText);

        this.matchPattern = new MatchPattern();
        this.contentContainer.addChild(this.matchPattern);

        // Message label
        this.messageText = new Text({
            text: '',
            style: {
                fontSize: 28,
                fill: 0xffffff,
                fontWeight: 'lighter',
            },
        });
        this.messageText.anchor.set(0.5, -0.75);
        this.contentContainer.addChild(this.messageText);

        // Create buttons
        this.audioButton = new AudioButton();
        this.settingsButton = new IconButton({
            imageDefault: 'icon-button-settings-default-view',
            imageHover: 'icon-button-settings-hover-view',
            imagePressed: 'icon-button-settings-active-view',
            imageDisabled: 'icon-button-settings-active-view',
        });
        this.infoButton = new IconButton({
            imageDefault: 'icon-button-info-default-view',
            imageHover: 'icon-button-info-hover-view',
            imagePressed: 'icon-button-info-active-view',
            imageDisabled: 'icon-button-info-active-view',
        });
        this.minusButton = new IconButton({
            imageDefault: 'icon-button-minus-default-view',
            imageHover: 'icon-button-minus-hover-view',
            imagePressed: 'icon-button-minus-active-view',
            imageDisabled: 'icon-button-minus-disabled-view',
        });

        this.spinButton = new SpinButton();

        this.plusButton = new IconButton({
            imageDefault: 'icon-button-add-default-view',
            imageHover: 'icon-button-add-hover-view',
            imagePressed: 'icon-button-add-active-view',
            imageDisabled: 'icon-button-add-disabled-view',
        });
        this.autoplayButton = new IconButton({
            imageDefault: 'icon-button-autoplay-default-view',
            imageHover: 'icon-button-autoplay-hover-view',
            imagePressed: 'icon-button-autoplay-active-view',
            imageDisabled: 'icon-button-autoplay-disabled-view',
        });

        this.contentContainer.addChild(this.audioButton);
        this.contentContainer.addChild(this.infoButton);
        this.contentContainer.addChild(this.settingsButton);
        this.contentContainer.addChild(this.minusButton);
        this.contentContainer.addChild(this.spinButton);
        this.contentContainer.addChild(this.plusButton);
        this.contentContainer.addChild(this.autoplayButton);

        userSettings.setBalance(5000);
    }

    /**
     * Layout the control panel based on screen width
     */
    public resize(width: number, height: number, isMobile?: boolean) {
        const isPortrait = height > width;

        // === MOBILE PORTRAIT ===
        if (isMobile && isPortrait) {
            this.panelHeight = 400;

            // Background
            // this.background.alpha = 0;
            this.background.width = width;
            this.background.height = this.panelHeight;
            this.y = height - this.panelHeight;

            // Content container
            this.contentWidth = width;
            this.contentContainer.x = 0;

            // Adjust button sizes for mobile
            const buttonScale = 1.75;
            const spinButtonScale = 1.75;

            this.audioButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (vertical stack on far left)
            const leftBtnStartX = 120;
            const leftBtnY = 120;

            this.infoButton.x = leftBtnStartX;
            this.infoButton.y = leftBtnY;

            this.audioButton.x = leftBtnStartX;
            this.audioButton.y = leftBtnY + 110;

            // Center - Large spin button
            this.spinButton.x = this.contentWidth / 2;
            this.spinButton.y = this.panelHeight * 0.5 - 20;

            const betBtnX = 220;

            this.minusButton.x = width / 2 - betBtnX;
            this.minusButton.y = this.panelHeight * 0.5 - 20;

            this.plusButton.x = width / 2 + betBtnX;
            this.plusButton.y = this.panelHeight * 0.5 - 20;

            // Right side buttons (vertical stack on far right)
            const rightBtnEndX = width - 130;
            const rightBtnY = 120;

            this.autoplayButton.x = rightBtnEndX;
            this.autoplayButton.y = rightBtnY;

            this.settingsButton.x = rightBtnEndX;
            this.settingsButton.y = rightBtnY + 110;

            // Bottom left - Credit display
            this.creditDisplay.x = 90;
            this.creditDisplay.y = 300;
            this.creditDisplay.scale.set(1.6);
            this.creditDisplay.setAlign('left');

            // Bottom right - Bet display
            this.betDisplay.x = width - this.betDisplay.width * 1.5;
            this.betDisplay.y = 300;
            this.betDisplay.scale.set(1.6);
            this.betDisplay.setAlign('right');

            // Message
            this.titleText.x = this.contentWidth / 2;
            this.titleText.y = height / 2;
            this.titleText.style.fontSize = 42;

            this.messageText.x = this.contentWidth / 2;
            this.messageText.y = this.panelHeight / 2;
        }
        // === MOBILE LANDSCAPE ===
        else if (isMobile && !isPortrait) {
            this.panelHeight = 210;

            // Background
            // this.background.alpha = 0.7;
            this.background.width = width;
            this.background.height = this.panelHeight;
            this.y = height - this.panelHeight;

            // Content container
            this.contentWidth = width;
            this.contentContainer.x = 0;

            // Adjust button sizes for mobile
            const buttonScale = 1.5;
            const spinButtonScale = 1.25;

            this.audioButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (vertical stack, more compact)
            this.audioButton.x = 120;
            this.audioButton.y = 50;
            this.settingsButton.x = 120;
            this.settingsButton.y = 150;
            this.infoButton.x = 210;
            this.infoButton.y = 100;

            // Bottom left - Credit and Bet displays
            this.creditDisplay.x = 260;
            this.creditDisplay.y = 130;
            this.creditDisplay.scale.set(1.3);
            this.creditDisplay.setAlign('left');

            this.betDisplay.x = 500;
            this.betDisplay.y = 130;
            this.betDisplay.scale.set(1.3);
            this.betDisplay.setAlign('left');

            // Center message (smaller font)
            this.titleText.x = this.contentWidth / 2;
            this.titleText.y = 60;
            this.titleText.style.fontSize = 42;

            // Right side buttons (horizontal, compact)
            const rightCenterX = this.contentWidth - 310;
            const buttonY = 60;

            this.minusButton.x = rightCenterX - 170;
            this.minusButton.y = buttonY;

            this.spinButton.x = rightCenterX;
            this.spinButton.y = buttonY;

            this.plusButton.x = rightCenterX + 170;
            this.plusButton.y = buttonY;

            // Autoplay button (bottom right, compact)
            this.autoplayButton.x = this.contentWidth - 180;
            this.autoplayButton.y = 160;

            this.messageText.x = this.contentWidth / 2;
            this.messageText.y = this.panelHeight / 2;
        }
        // === DESKTOP ===
        else {
            this.panelHeight = 160;

            // Background
            // this.background.alpha = 0.7;
            this.background.width = width;
            this.background.height = this.panelHeight;
            this.y = height - this.panelHeight;

            // Content container with max width
            const maxWidth = 1600;
            this.contentWidth = Math.min(width, maxWidth);
            this.contentContainer.x = (width - this.contentWidth) / 2;

            // Desktop button sizes (normal)
            const buttonScale = 1;
            const spinButtonScale = 1;

            this.audioButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (stacked vertically)
            this.audioButton.x = 50;
            this.audioButton.y = 40;
            this.settingsButton.x = 50;
            this.settingsButton.y = 100;
            this.infoButton.x = 110;
            this.infoButton.y = 70;

            // Bottom left - Credit and Bet displays
            this.creditDisplay.x = 130;
            this.creditDisplay.y = 100;
            this.creditDisplay.scale.set(1);
            this.creditDisplay.setAlign('left');

            this.betDisplay.x = 330;
            this.betDisplay.y = 100;
            this.betDisplay.scale.set(1);
            this.betDisplay.setAlign('left');

            // Center message (relative to content container)
            this.titleText.x = this.contentWidth / 2;
            this.titleText.y = 80;
            this.titleText.style.fontSize = 32;

            this.messageText.x = this.contentWidth / 2;
            this.messageText.y = this.panelHeight / 2;

            // Right side buttons (horizontal layout centered around spin button)
            const rightCenterX = this.contentWidth - 200;
            const buttonY = 40;

            const betBtnX = 125;

            this.minusButton.x = rightCenterX - betBtnX;
            this.minusButton.y = buttonY;

            this.spinButton.x = rightCenterX;
            this.spinButton.y = buttonY;

            this.plusButton.x = rightCenterX + betBtnX;
            this.plusButton.y = buttonY;

            // Autoplay button (bottom right)
            this.autoplayButton.x = this.contentWidth - 100;
            this.autoplayButton.y = 120;
        }

        this.matchPattern.x = this.contentWidth * 0.5 - this.matchPattern.width * 0.5;
        this.matchPattern.y = this.panelHeight - this.matchPattern.height - 20;
    }

    /**
     * Update credit display
     */
    public setCredit(value: number) {
        this.creditDisplay.setValue(value, this.currency);
    }

    /**
     * Update bet display
     */
    public setBet(value: number) {
        this.betDisplay.setValue(value, this.currency);
    }

    /**
     * Update center message
     */
    public setTitle(title: string) {
        this.titleText.text = title;
        this.titleText.style.fontSize = 32;
        this.titleText.anchor.set(0.5, 0.75);
    }

    /**
     * Update center message
     */
    public setWinTitle(title: string) {
        this.titleText.text = title;
        this.titleText.style.fontSize = 52;
        this.titleText.anchor.set(0.5, 1);
    }

    /**
     * Update center message
     */
    public setMessage(message: string) {
        this.messageText.text = message;
        // relayout the free spins label
        this.messageText.x = this.contentWidth / 2;
        this.messageText.y = this.panelHeight / 2;
    }

    /** Play all queued match patterns sequentially */
    public async playMatchMessages() {
        this.shouldStopMatches = false;
        for (const pattern of this.winMatchPatterns) {
            if (this.shouldStopMatches) {
                break;
            }
            this.matchPattern.setup(pattern.times, `symbol-${pattern.type}`, pattern.amount, pattern.currency);
            this.matchPattern.x = this.contentWidth * 0.5 - this.matchPattern.width * 0.5;
            this.matchPattern.y = this.panelHeight - this.matchPattern.height - 20;
            this.messageText.alpha = 0;
            await this.matchPattern.show();
            this.messageText.alpha = 1;
        }

        // Clear the queue after playing all
        this.winMatchPatterns = [];
        this.shouldStopMatches = false;
    }

    public stopMatchMessages() {
        this.shouldStopMatches = true;
        // Kill any ongoing animations
        this.matchPattern.hide();
        // Clear the queue immediately
        this.winMatchPatterns = [];
    }

    /** Set match pattern result */
    public async addMatchMessage(times: number, type: number, amount: number, currency: string) {
        this.winMatchPatterns.push({
            times,
            type,
            amount,
            currency,
        });
    }

    /** Disabled betting */
    public disableBetting() {
        this.autoplayButton.enabled = false;
        this.plusButton.enabled = false;
        this.minusButton.enabled = false;

        this.spinButton.setState(SpinButtonState.STOP);
    }

    /** Disabled betting */
    public enableBetting() {
        this.autoplayButton.enabled = true;
        this.plusButton.enabled = true;
        this.minusButton.enabled = true;

        this.spinButton.setState(SpinButtonState.PLAY);
    }

    /** Enabled autoplay button */
    public disableAutoplay() {
        this.autoplayButton.enabled = false;
    }

    /** Enabled autoplay button */
    public enableAutoplay() {
        this.autoplayButton.enabled = true;
    }

    /** Collect */
    public async collect() {
        // await BetAPI.collect();
    }

    /**
     * Set button event handlers
     */
    public onSpin(callback: () => void) {
        this.spinButton.on('pointerdown', () => callback());
    }

    public onAutoplay(callback: () => void) {
        this.autoplayButton.on('pointerdown', () => callback());
    }

    public onIncreaseBet(callback: () => void) {
        this.plusButton.on('pointerdown', callback);
    }

    public onDecreaseBet(callback: () => void) {
        this.minusButton.on('pointerdown', callback);
    }

    public onInfo(callback: () => void) {
        this.infoButton.on('pointerdown', callback);
    }

    public onSettings(callback: () => void) {
        this.settingsButton.on('pointerdown', callback);
    }

    /**
     * Listen for spacebar press
     */
    public onSpacebar(callback: () => void) {
        if (this.spacebarHandler) {
            window.removeEventListener('keydown', this.spacebarHandler);
        }

        // Create new handler
        this.spacebarHandler = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
            callback();
            }
        };

        // Add event listener
        window.addEventListener('keydown', this.spacebarHandler);
    }
}
