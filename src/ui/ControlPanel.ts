import { Container, Text, Graphics, Sprite } from 'pixi.js';

/**
 * Control panel for the game, displaying credit, bet info, and action buttons
 */
export class ControlPanel extends Container {
    private background: Graphics;
    private contentContainer: Container;
    private creditLabel: Text;
    private creditValue: Text;
    private betLabel: Text;
    private betValue: Text;
    private messageText: Text;
    private spinIcon: Sprite;
    // private stopIcon: Sprite;

    private menuButton: Container;
    private infoButton: Container;
    private settingsButton: Container;
    private minusButton: Container;
    private spinButton: Container;
    private plusButton: Container;
    private autoplayButton: Container;
    private autoplayIcon!: Sprite;

    private spacebarHandler?: (e: KeyboardEvent) => void;

    // Button states
    private isSpinButtonEnabled: boolean = true;
    private isSpinning: boolean = false;
    private canInterrupt: boolean = false;

    constructor() {
        super();

        // Create semi-transparent background
        this.background = new Graphics();
        this.addChild(this.background);

        // Create content container with max width
        this.contentContainer = new Container();
        this.addChild(this.contentContainer);

        // Credit display (bottom left)
        this.creditLabel = new Text({
            text: 'CREDIT',
            style: {
                fontSize: 18,
                fill: 0xffffff,
                fontWeight: 'bold',
            },
        });
        this.contentContainer.addChild(this.creditLabel);

        this.creditValue = new Text({
            text: '$100,000.00',
            style: {
                fontSize: 20,
                fill: 0xffd700,
                fontWeight: 'bold',
            },
        });
        this.contentContainer.addChild(this.creditValue);

        // Bet display (bottom left, next to credit)
        this.betLabel = new Text({
            text: 'BET',
            style: {
                fontSize: 18,
                fill: 0xffffff,
                fontWeight: 'bold',
            },
        });
        this.contentContainer.addChild(this.betLabel);

        this.betValue = new Text({
            text: '$2.00',
            style: {
                fontSize: 20,
                fill: 0xffd700,
                fontWeight: 'bold',
            },
        });
        this.contentContainer.addChild(this.betValue);

        // Center message
        this.messageText = new Text({
            text: 'HOLD SPACE FOR TURBO SPIN',
            style: {
                fontSize: 28,
                fill: 0xffd700,
                fontWeight: 'bold',
            },
        });
        this.messageText.anchor.set(0.5);
        this.contentContainer.addChild(this.messageText);

        // Create buttons
        this.menuButton = this.createButton('control-panel-menu', 0x4a4a4a);
        this.settingsButton = this.createButton('control-panel-settings', 0x4a4a4a);
        this.infoButton = this.createButton('control-panel-info', 0x4a4a4a);
        this.minusButton = this.createButton('control-panel-subtract', 0x4a4a4a);
        this.spinButton = this.createSpinButton();
        this.plusButton = this.createButton('control-panel-add', 0x4a4a4a);
        this.autoplayButton = this.createButton('control-panel-autoplay', 0x4a4a4a);

        this.contentContainer.addChild(this.menuButton);
        this.contentContainer.addChild(this.infoButton);
        this.contentContainer.addChild(this.settingsButton);
        this.contentContainer.addChild(this.minusButton);
        this.contentContainer.addChild(this.spinButton);
        this.contentContainer.addChild(this.plusButton);
        this.contentContainer.addChild(this.autoplayButton);

        // Spin and Stop Buttons
        this.spinIcon = Sprite.from('control-panel-spin');
        this.spinIcon.anchor.set(0.5);
        this.spinIcon.scale.set(0.85);
        this.spinButton.addChild(this.spinIcon);
        // this.stop = Sprite.from('control-panel-stop');
        // this.stop.anchor.set(0.5);
        // this.stop.scale.set(0.15);
        // this.spinButton.addChild(this.stop);
    }

    /**
     * Create a circular button with icon
     */
    private createButton(spriteName: string, color: number): Container {
        const button = new Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';

        // Get sprite to determine circle size
        const icon = Sprite.from(spriteName);
        icon.anchor.set(0.5);

        // Circle background - sized based on sprite
        const size = Math.max(icon.width, icon.height) / 2 + 2; // Add padding
        const circle = new Graphics();
        circle.circle(0, 0, size);
        circle.fill(color);
        button.addChild(circle);

        // Add icon sprite
        button.addChild(icon);

        // Hover effects
        button.on('pointerover', () => {
            circle.tint = 0xcccccc;
        });
        button.on('pointerout', () => {
            circle.tint = 0xffffff;
        });

        return button;
    }

    /**
     * Create the large spin button
     */
    private createSpinButton(): Container {
        const button = new Container();
        button.eventMode = 'static';
        button.cursor = 'pointer';

        // Larger circle with white border
        const circle = new Graphics();
        circle.circle(0, 0, 75);
        circle.fill(0x4a4a4a);
        // circle.stroke({ color: 0x000000, width: 2 });
        button.addChild(circle);

        // Spin icon (circular arrow) - larger
        const icon = new Graphics();
        icon.stroke({ color: 0xffffff, width: 5, alpha: 1 });
        icon.arc(0, 0, 30, 0, Math.PI * 1.5);
        icon.moveTo(21, -21);
        icon.lineTo(30, -12);
        icon.lineTo(18, -18);
        button.addChild(icon);

        button.on('pointerover', () => {
            if (!this.isSpinButtonEnabled) return;
            circle.tint = 0xcccccc;
            this.spinIcon.tint = 0xcccccc;
        });

        button.on('pointerout', () => {
            if (!this.isSpinButtonEnabled) return;
            circle.tint = 0xffffff;
            this.spinIcon.tint = 0xffffff;
        });

        return button;
    }

    /**
     * Layout the control panel based on screen width
     */
    public resize(width: number, height: number, isMobile?: boolean) {
        const isPortrait = height > width;

        // === MOBILE PORTRAIT ===
        if (isMobile && isPortrait) {
            const panelHeight = 400;

            // Background
            this.background.clear();
            this.background.rect(0, 0, width, panelHeight);
            this.background.fill({ color: 0x000000, alpha: 0.7 });
            this.y = height - panelHeight;

            // Content container
            const contentWidth = width;
            this.contentContainer.x = 0;

            // Adjust button sizes for mobile
            const buttonScale = 2;
            const spinButtonScale = 2;

            this.menuButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (vertical stack on far left)
            const leftBtnStartX = 120;
            const leftBtnY = 80;

            this.infoButton.x = leftBtnStartX;
            this.infoButton.y = leftBtnY;

            this.menuButton.x = leftBtnStartX;
            this.menuButton.y = leftBtnY + 130;

            // Center - Large spin button
            this.spinButton.x = contentWidth / 2;
            this.spinButton.y = panelHeight * 0.5;

            this.minusButton.x = width / 2 - 220;
            this.minusButton.y = panelHeight * 0.5;

            this.plusButton.x = width / 2 + 220;
            this.plusButton.y = panelHeight * 0.5;

            // Right side buttons (vertical stack on far right)
            const rightBtnEndX = width - 130;
            const rightBtnY = 80;

            this.autoplayButton.x = rightBtnEndX;
            this.autoplayButton.y = rightBtnY;

            this.settingsButton.x = rightBtnEndX;
            this.settingsButton.y = rightBtnY + 130;

            // Bottom left - Credit info (vertical stack)
            const creditStartX = 90;
            const creditEndX = width - 90;
            const bottomY = 340;

            this.creditLabel.x = creditStartX;
            this.creditLabel.y = bottomY - 40; // Label above
            this.creditLabel.style.fontSize = 32;
            this.creditLabel.anchor.set(0, 0);

            this.creditValue.x = creditStartX;
            this.creditValue.y = bottomY; // Value below
            this.creditValue.style.fontSize = 42;
            this.creditValue.anchor.set(0, 0);

            // Bottom right - Bet info (vertical stack, aligned to right edge)
            this.betLabel.x = creditEndX;
            this.betLabel.y = bottomY - 40; // Label above
            this.betLabel.style.fontSize = 32;
            this.betLabel.anchor.set(1, 0); // Right-align the text

            this.betValue.x = creditEndX;
            this.betValue.y = bottomY; // Value below
            this.betValue.style.fontSize = 42;
            this.betValue.anchor.set(1, 0); // Right-align the text

            // Message (bottom center, small)
            this.messageText.x = contentWidth / 2;
            this.messageText.y = height / 2;
            this.messageText.style.fontSize = 42;
        }
        // === MOBILE LANDSCAPE ===
        else if (isMobile && !isPortrait) {
            const panelHeight = 210;

            // Background
            this.background.clear();
            this.background.rect(0, 0, width, panelHeight);
            this.background.fill({ color: 0x000000, alpha: 0.7 });
            this.y = height - panelHeight;

            // Content container
            const contentWidth = width;
            this.contentContainer.x = 0;

            // Adjust button sizes for mobile
            const buttonScale = 1.5;
            const spinButtonScale = 1.5;

            this.menuButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (vertical stack, more compact)
            this.menuButton.x = 120;
            this.menuButton.y = 50;
            this.settingsButton.x = 120;
            this.settingsButton.y = 150;
            this.infoButton.x = 210;
            this.infoButton.y = 100;

            // Bottom left - Credit and Bet (horizontal, compact)
            const creditStartX = 180;
            const bottomY = 160;

            this.creditLabel.x = creditStartX;
            this.creditLabel.y = bottomY;
            this.creditLabel.style.fontSize = 32;
            this.creditLabel.anchor.set(0, 0); // Reset anchor to left-align

            this.creditValue.x = creditStartX + 160;
            this.creditValue.y = bottomY;
            this.creditValue.style.fontSize = 32;
            this.creditValue.anchor.set(0, 0); // Reset anchor to left-align

            this.betLabel.x = creditStartX + 380;
            this.betLabel.y = bottomY;
            this.betLabel.style.fontSize = 32;
            this.betLabel.anchor.set(0, 0); // Reset anchor to left-align

            this.betValue.x = creditStartX + 480;
            this.betValue.y = bottomY;
            this.betValue.style.fontSize = 32;
            this.betValue.anchor.set(0, 0);

            // Center message (smaller font)
            this.messageText.x = contentWidth / 2;
            this.messageText.y = 70;
            this.messageText.style.fontSize = 22;

            // Right side buttons (horizontal, compact)
            const rightCenterX = contentWidth - 310;
            const buttonY = 60;

            this.minusButton.x = rightCenterX - 170;
            this.minusButton.y = buttonY;

            this.spinButton.x = rightCenterX;
            this.spinButton.y = buttonY;

            this.plusButton.x = rightCenterX + 170;
            this.plusButton.y = buttonY;

            // Autoplay button (bottom right, compact)
            this.autoplayButton.x = contentWidth - 180;
            this.autoplayButton.y = 160;

            // Message (bottom center, small)
            this.messageText.x = contentWidth / 2;
            this.messageText.y = 60;
            this.messageText.style.fontSize = 42;
        }
        // === DESKTOP ===
        else {
            const panelHeight = 160;

            // Background
            this.background.clear();
            this.background.rect(0, 0, width, panelHeight);
            this.background.fill({ color: 0x000000, alpha: 0.7 });
            this.y = height - panelHeight;

            // Content container with max width
            const maxWidth = 1600;
            const contentWidth = Math.min(width, maxWidth);
            this.contentContainer.x = (width - contentWidth) / 2;

            // Desktop button sizes (normal)
            const buttonScale = 1;
            const spinButtonScale = 1;

            this.menuButton.scale.set(buttonScale);
            this.infoButton.scale.set(buttonScale);
            this.settingsButton.scale.set(buttonScale);
            this.minusButton.scale.set(buttonScale);
            this.plusButton.scale.set(buttonScale);
            this.spinButton.scale.set(spinButtonScale);
            this.autoplayButton.scale.set(buttonScale);

            // Left side buttons (stacked vertically)
            this.menuButton.x = 50;
            this.menuButton.y = 40;
            this.settingsButton.x = 50;
            this.settingsButton.y = 100;
            this.infoButton.x = 120;
            this.infoButton.y = 70;

            // Bottom left - Credit and Bet info (horizontal layout)
            const creditStartX = 130;
            const bottomY = 125;

            this.creditLabel.x = creditStartX;
            this.creditLabel.y = bottomY;
            this.creditValue.x = creditStartX + 70;
            this.creditValue.y = bottomY;

            this.betLabel.x = creditStartX + 250;
            this.betLabel.y = bottomY;
            this.betValue.x = creditStartX + 290;
            this.betValue.y = bottomY;

            // Center message (relative to content container)
            this.messageText.x = contentWidth / 2;
            this.messageText.y = 80;
            this.messageText.style.fontSize = 28;

            // Right side buttons (horizontal layout centered around spin button)
            const rightCenterX = contentWidth - 200;
            const buttonY = 40;

            this.minusButton.x = rightCenterX - 130;
            this.minusButton.y = buttonY;

            this.spinButton.x = rightCenterX;
            this.spinButton.y = buttonY;

            this.plusButton.x = rightCenterX + 130;
            this.plusButton.y = buttonY;

            // Autoplay button (bottom right)
            this.autoplayButton.x = contentWidth - 100;
            this.autoplayButton.y = 120;
        }
    }

    /** Set is spinning */
    public setIsSpinning(value: boolean) {
        this.isSpinning = value;
    }

    /**
     * Update credit display
     */
    public setCredit(value: number) {
        this.creditValue.text = `$${value.toFixed(2)}`;
    }

    /**
     * Update bet display
     */
    public setBet(value: number) {
        this.betValue.text = `$${value.toFixed(2)}`;
    }

    /**
     * Update center message
     */
    public setMessage(message: string) {
        this.messageText.text = message;
    }

    /**
     * Set button event handlers
     */
    public onSpin(callback: () => void) {
        this.spinButton.on('pointerdown', () => {
            if (this.isSpinButtonEnabled) {
                callback();
            }
        });
    }

    public onAutoplay(callback: () => void) {
        this.autoplayButton.on('pointerdown', () => {
            if (this.isSpinButtonEnabled) {
                callback();
            }
        });
    }

    public onIncreaseBet(callback: () => void) {
        this.plusButton.on('pointerdown', callback);
    }

    public onDecreaseBet(callback: () => void) {
        this.minusButton.on('pointerdown', callback);
    }

    public onMenu(callback: () => void) {
        this.menuButton.on('pointerdown', callback);
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
