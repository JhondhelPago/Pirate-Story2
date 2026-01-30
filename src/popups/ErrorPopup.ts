import { Container, Sprite, Texture } from 'pixi.js';
import { Label } from '../ui/Label';
import { IconButton } from '../ui/IconButton2';
import { navigation } from '../utils/navigation';
import { i18n } from '../i18n/i18n';

export type ErrorPopupData = {
    title: string;
    message: string;
    onClose?: () => void;
};

/** Popup for volume and game mode settings */
export class ErrorPopup extends Container {
    private bg: Sprite;
    /** Title  of the modal*/
    private title: Label;
    /** Message of the modal */
    private messageLabel: Label;
    /** Close button */
    private closeButton: IconButton;
    /** The panel background sprite */
    private panelBg: Sprite;
    /** Base container for all panel content */
    private panelBase: Container;
    /** Height of the panel */
    private panelHeight: number = 0;
    /** Width of the panel */
    private panelWidth: number = 0;
    /** on click continue */
    private onPressClose?: () => void;

    constructor() {
        super();

        this.bg = Sprite.from(Texture.WHITE);
        this.bg.interactive = true;
        this.bg.alpha = 0.7;
        this.bg.tint = 0x000000;
        this.addChild(this.bg);

        this.panelWidth = 700;
        this.panelHeight = 400;

        // Create panel base container
        this.panelBase = new Container();
        this.addChild(this.panelBase);

        // Create panel background sprite
        this.panelBg = Sprite.from(Texture.WHITE);
        this.panelBg.tint = 0x3b3b3b;
        this.panelBg.width = this.panelWidth;
        this.panelBg.height = this.panelHeight;
        this.panelBase.addChild(this.panelBg);

        this.title = new Label(i18n.t('error'), {
            fill: '#FCC100',
        });
        this.title.anchor.set(0.5);
        this.title.style.fontSize = 32;
        this.panelBase.addChild(this.title);

        this.messageLabel = new Label(i18n.t('unexpectedErrorOccured'), {
            fill: '#FFFFFF',
        });
        this.messageLabel.anchor.set(0.5);
        this.messageLabel.style.fontSize = 32;
        this.panelBase.addChild(this.messageLabel);

        this.closeButton = new IconButton({
            imageDefault: 'icon-button-default-close-view',
            imageHover: 'icon-button-active-close-view',
            imagePressed: 'icon-button-active-close-view',
            imageDisabled: 'icon-button-default-close-view',
        });
        this.closeButton.scale.set(0.5);
        this.closeButton.onPress.connect(() => {
            navigation.dismissPopup();
            this.onPressClose?.();
        });
        this.panelBase.addChild(this.closeButton);

        // Center panel base
        this.panelBase.pivot.set(this.panelWidth / 2, this.panelHeight / 2);
    }

    /** Resize the popup, fired whenever window size changes */
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        let titleFontSize: number;
        let closeButtonScale: number;
        if (isMobile && isPortrait) {
            this.panelWidth = width * (isPortrait ? 0.9 : 0.85);
            this.panelHeight = 600;
            titleFontSize = 52;
            closeButtonScale = 0.75;
        } else {
            this.panelWidth = 700;
            this.panelHeight = 400;
            titleFontSize = 32;
            closeButtonScale = 0.5;
        }

        /** Panel background sprite */
        this.panelBg.width = this.panelWidth;
        this.panelBg.height = this.panelHeight;

        /** Center panel base */
        this.panelBase.pivot.set(this.panelWidth / 2, this.panelHeight / 2);
        this.panelBase.x = width * 0.5;
        this.panelBase.y = height * 0.5;

        /** Title */
        this.title.style.fontSize = titleFontSize;
        this.title.x = this.panelWidth * 0.5;
        this.title.y = 100;

        /** message */
        this.messageLabel.style.fontSize = titleFontSize;
        this.messageLabel.x = this.panelWidth * 0.5;
        this.messageLabel.y = this.panelHeight * 0.5;

        /** Close button */
        this.closeButton.scale.set(closeButtonScale);
        this.closeButton.x = this.panelWidth - 60;
        this.closeButton.y = 60;
    }

    /** Set things up just before showing the popup */
    public prepare(data: ErrorPopupData) {
        if (data) {
            this.title.text = data.title ?? 'Error';
            this.messageLabel.text = data.message;
            this.onPressClose = data.onClose;
        }
    }

    public update() {}
}
