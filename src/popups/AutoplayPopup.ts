import { Container, Sprite, Text, Texture } from 'pixi.js';
import { List } from '@pixi/ui';
import { navigation } from '../utils/navigation';
import { CheckboxWithLabel } from '../ui/CheckboxWithLabel';
import { IconButton } from '../ui/IconButton2';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { SlotSpinMode } from '../slot/SlotConfig';
import { i18n } from '../i18n/i18n';
import { SpinModeEnum, userSettings } from '../utils/userSettings';

export type AutoplayPopupData = {
    spinMode: SlotSpinMode;
    callback: (spins: number) => void;
};

/** Popup for autoplay settings */
export class AutoplayPopup extends Container {
    /** The dark semi-transparent background covering current screen */
    private bg: Sprite;
    /** Panel background sprite */
    private panelBg: Sprite;
    /** Base container for all panel content */
    private panelBase: Container;
    /** layout */
    private layout: List;
    /** Close button */
    private closeButton: IconButton;
    /** modal title */
    private title: Text;
    /** Quick spin */
    private quickSpinCheckbox: CheckboxWithLabel;
    /** Turbo Spin */
    private turboSpinCheckbox: CheckboxWithLabel;
    /** Autoplay button */
    private autoplayButton: Button;
    /** autoplay slider */
    private autoplaySlider: Slider;
    /** autoplay count */
    private autoplayCount: number = 10;
    /** Panel dimensions */
    private panelWidth = 540;
    private panelHeight = 570;
    private onAutoplayPress?: (spins: number) => void;

    constructor() {
        super();

        this.bg = Sprite.from(Texture.WHITE);
        this.bg.interactive = true;
        this.bg.alpha = 0.7;
        this.bg.tint = 0x000000;
        this.addChild(this.bg);

        // Create panel base container
        this.panelBase = new Container();
        this.addChild(this.panelBase);

        // Create panel background sprite
        this.panelBg = Sprite.from(Texture.WHITE);
        this.panelBg.tint = 0x3b3b3b;
        this.panelBg.width = this.panelWidth;
        this.panelBg.height = this.panelHeight;
        this.panelBase.addChild(this.panelBg);

        this.layout = new List({ type: 'vertical', elementsMargin: 40 });
        this.layout.x = this.panelWidth / 2;
        this.layout.y = 100;
        this.panelBase.addChild(this.layout);

        this.closeButton = new IconButton({
            imageDefault: 'icon-button-default-close-view',
            imageHover: 'icon-button-active-close-view',
            imagePressed: 'icon-button-active-close-view',
            imageDisabled: 'icon-button-default-close-view',
        });
        this.closeButton.scale.set(0.5);
        this.closeButton.x = this.panelWidth - this.closeButton.width - 20;
        this.closeButton.y = this.closeButton.width + 20;
        this.closeButton.onPress.connect(() => {
            navigation.dismissPopup();
        });
        this.panelBase.addChild(this.closeButton);

        this.title = new Text({
            text: i18n.t('autoplaySettings'),
            style: {
                fill: '#FCC100',
                fontSize: 32,
                fontWeight: 'bold',
            },
        });
        this.title.anchor.set(0.5);
        this.layout.addChild(this.title);

        // Quick Spin
        this.quickSpinCheckbox = new CheckboxWithLabel({
            label: i18n.t('quickSpin'),
            isChecked: false,
        });
        this.quickSpinCheckbox.checkbox.onChange = (state) => {
            if (state === 1) {
                userSettings.setSpinMode(SpinModeEnum.Quick);
                this.turboSpinCheckbox.checkbox.switcher.forceSwitch(0);
            } else {
                const turboIsOn = this.turboSpinCheckbox.checkbox.state === 1;

                if (!turboIsOn) {
                    userSettings.setSpinMode(SpinModeEnum.Normal);
                }
            }
        };


        this.layout.addChild(this.quickSpinCheckbox);

        // Turbo Spin
        this.turboSpinCheckbox = new CheckboxWithLabel({
            label: i18n.t('turboSpin'),
            isChecked: false,
        });

        this.turboSpinCheckbox.checkbox.switcher.onChange.connect((state: number | boolean) => {
            if (state == 1) {
                const spinMode = SpinModeEnum.Turbo;
                userSettings.setSpinMode(spinMode);
                this.quickSpinCheckbox.checkbox.switcher.forceSwitch(0);
            } else {
                const quickIsOn = this.quickSpinCheckbox.checkbox.state === 1;
                
                if (!quickIsOn) {
                    userSettings.setSpinMode(SpinModeEnum.Normal);
                }
            }
        });
        this.layout.addChild(this.turboSpinCheckbox);

        // Autoplay slider
        this.autoplaySlider = new Slider({
            text: i18n.t('numberOfAutoSpins', { autospins: this.autoplayCount }),
            min: 10,
            max: 1000000,
            value: 10,
        });
        this.autoplaySlider.onUpdate.connect((value: number) => {
            this.autoplayCount = Math.round(value / 10) * 10; // Round to nearest 10
            this.autoplaySlider.text = i18n.t('numberOfAutoSpins', { autospins: this.autoplayCount });
            this.autoplayButton.setText(i18n.t('autoplay', { autospins: this.autoplayCount }));
        });
        this.layout.addChild(this.autoplaySlider);

        // Autoplay start button
        this.autoplayButton = new Button({
            text: i18n.t('autoplay', { autospins: this.autoplayCount }),
        });
        this.autoplayButton.onPress.connect(() => this.onAutoplayPress?.(this.autoplayCount));
        this.autoplayButton.anchor.set(0.5);
        this.layout.addChild(this.autoplayButton);

        // Center panel base
        this.panelBase.pivot.set(this.panelWidth / 2, this.panelHeight / 2);

        // ✅ Initialize checkboxes from saved settings once (helps first open too)
        this.syncSpinModeUI(this.getSavedSpinModeOr('normal-spin'));
    }

    /** Safely read saved spin mode from userSettings if available */
    private getSavedSpinModeOr(fallback: SlotSpinMode): SlotSpinMode {
        const anySettings: any = userSettings as any;
        const mode = typeof anySettings.getSpinMode === 'function' ? anySettings.getSpinMode() : undefined;
        return (mode ?? fallback) as SlotSpinMode;
    }

    /** Update checkbox UI based on a spin mode */
    private syncSpinModeUI(mode: SlotSpinMode) {
        this.quickSpinCheckbox.checkbox.switcher.forceSwitch(mode === 'quick-spin' ? 1 : 0);
        this.turboSpinCheckbox.checkbox.switcher.forceSwitch(mode === 'turbo-spin' ? 1 : 0);
    }

    /** Resize the popup, fired whenever window size changes */
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        this.panelBase.x = width * 0.5;
        this.panelBase.y = height * 0.5;

        const isMobile = document.documentElement.id === 'isMobile';
        if (isMobile) {
            this.panelBase.scale.set(1.5);
        } else {
            this.panelBase.scale.set(1);
        }
    }

    /** Set things up just before showing the popup */
    public prepare(data: AutoplayPopupData) {
        if (data) {
            // ✅ Prefer saved spin mode so it "remembers" across opens
            const savedMode = this.getSavedSpinModeOr(data.spinMode);
            this.syncSpinModeUI(savedMode);

            this.onAutoplayPress = data.callback;
        }
    }

    /** Show the popup */
    public async show() {
        // ✅ Also re-sync on show in case the mode changed while popup was closed
        this.syncSpinModeUI(this.getSavedSpinModeOr('normal-spin'));
        this.visible = true;
    }

    /** Hide the popup */
    public async hide() {
        this.visible = false;
    }
}
