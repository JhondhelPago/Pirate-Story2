import { Container, Sprite, Texture, Text, Matrix } from 'pixi.js';
import gsap from 'gsap';
import { navigation } from '../utils/navigation';
import { ConfirmationBuyFreeSpinPopup } from './BuyFreeConfirmationPopup';
import { GameScreen } from '../screens/GameScreen';

// ✅ use already-loaded config from userSettings.ts
import { userSettings } from '../utils/userSettings';
import Config from '../slot/SlotSettings';

// ✅ updated imports (letter type + definition)
import { BuyFreeSpinOptionBanner, type BuyFreeTypeLetter, type BuyFreeTypeDefinition } from '../ui/FeatureBanner';
import { i18n } from '../i18n/i18n';
import { CurrencyType, getCurrencySymbol } from '../utils/currencies';

type BuyFeature = {
    spins: number;
    scatters: number;
    buyFeatureBetMultiplier: number;
};

export class BuyFreeSpinPopup extends Container {
    private bg: Sprite;
    private panel: Container;

    // ✅ was Sprite, now Text with gradient fill + stroke
    private buyLabel: Text;

    private featureA: BuyFreeSpinOptionBanner;
    private featureB: BuyFreeSpinOptionBanner;
    private featureC: BuyFreeSpinOptionBanner;

    private exitButton: Sprite;

    private canClickAnywhere = false;
    private onSelect?: (value: BuyFreeTypeLetter) => void;

    private pulseTween?: gsap.core.Tween;

    // ✅ config now comes from userSettings.ts export
    private config = {} as any;

    private currencyType!: CurrencyType;
    private currencySymbol!: string;

    private static readonly PLACEHOLDER_TYPE_MAP: Record<BuyFreeTypeLetter, BuyFreeTypeDefinition> = {
        A: { bannerTextureKey: 'green-spin-banner', spins: 0, scatters: 0 },
        B: { bannerTextureKey: 'red-spin-banner', spins: 0, scatters: 0 },
        C: { bannerTextureKey: 'blue-spin-banner', spins: 0, scatters: 0 },
    };

    // -----------------------
    // Gradient cache (same idea as FeatureBanner)
    // -----------------------
    private static labelGradientTexture?: Texture;
    private static labelGradientMatrix?: Matrix;

    constructor() {
        super();
        this.eventMode = 'static';
        this.interactiveChildren = true;

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = 'static';
        this.addChild(this.bg);

        this.panel = new Container();
        this.addChild(this.panel);

        // ✅ Replace sprite label with styled text label
        this.buyLabel = this.createGradientLabelText(i18n.t('buyFreeSpins'), 110);
        this.panel.addChild(this.buyLabel);

        this.featureA = new BuyFreeSpinOptionBanner({
            typeLetter: 'A',
            typeMap: BuyFreeSpinPopup.PLACEHOLDER_TYPE_MAP,
            amount: 0,
            currencySymbol: '$',
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        this.featureB = new BuyFreeSpinOptionBanner({
            typeLetter: 'B',
            typeMap: BuyFreeSpinPopup.PLACEHOLDER_TYPE_MAP,
            amount: 0,
            currencySymbol: '$',
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        this.featureC = new BuyFreeSpinOptionBanner({
            typeLetter: 'C',
            typeMap: BuyFreeSpinPopup.PLACEHOLDER_TYPE_MAP,
            amount: 0,
            currencySymbol: '$',
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        const optionList = [this.featureA, this.featureB, this.featureC];
        for (const opt of optionList) {
            opt.visible = false;
            this.panel.addChild(opt);
        }

        // ✅ ARRAY-BASED taps
        this.featureA.setOnTap(() => this.onFeatureTap(0, 'A'));
        this.featureB.setOnTap(() => this.onFeatureTap(1, 'B'));
        this.featureC.setOnTap(() => this.onFeatureTap(2, 'C'));

        this.bg.on('pointertap', () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        this.exitButton = Sprite.from('cancel-button');
        this.exitButton.anchor.set(0.5);
        this.exitButton.scale.set(1.3);
        this.exitButton.eventMode = 'static';
        this.exitButton.cursor = 'pointer';
        this.addChild(this.exitButton);

        this.exitButton.on('pointerover', () => {
            gsap.to(this.exitButton.scale, { x: 1.1, y: 1.1, duration: 0.15 });
        });
        this.exitButton.on('pointerout', () => {
            gsap.to(this.exitButton.scale, { x: 1, y: 1, duration: 0.15 });
        });
        this.exitButton.on('pointertap', () => {
            gsap.to(this.exitButton.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.1,
                yoyo: true,
                repeat: 1,
            });
            this.hide();
        });
    }

    private getFeatureByIndex(index: number) {
        return this.config!.settings.features[index];
    }

    private onFeatureTap(index: number, letter: BuyFreeTypeLetter) {
        if (!this.config) return;

        const feature = this.getFeatureByIndex(index);
        const amount = feature.buyFeatureBetMultiplier * userSettings.getBet();
        const featureCode = index + 1; // equivalent feature value that the api expect

        // ✅ spinCount MUST match banner spins
        this.openConfirm(letter, amount, feature.spins, featureCode);
    }

    private openConfirm(typeLetter: BuyFreeTypeLetter, amount: number, spinCount: number, featureCode: number) {
        this.onSelect?.(typeLetter);

        navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
            confirmationBoard: 'buy-spin-confirm-board',
            spins: spinCount,
            amount,
            currencySymbol: this.currencySymbol,
            decimals: 0,
            confirmButton: 'confirm-button',
            cancelButton: 'cancel-button',
            onConfirm: () => {
                userSettings.setBalance(userSettings.getBalance() - amount);

                const game = navigation.currentScreen as GameScreen;
                game.onFreeSpinInitialStart(spinCount, featureCode);
            },
        });
    }

    private startLabelPulse() {
        gsap.killTweensOf(this.buyLabel.scale);

        this.pulseTween = gsap.to(this.buyLabel.scale, {
            x: this.buyLabel.scale.x * 1.05,
            y: this.buyLabel.scale.y * 1.05,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
        });
    }

    private stopLabelPulse() {
        this.pulseTween?.kill();
        gsap.to(this.buyLabel.scale, { x: 1, y: 1, duration: 0.2 });
    }

    private animateEntrance() {
        const options = [this.featureA, this.featureB, this.featureC];

        options.forEach((opt, index) => {
            gsap.killTweensOf(opt);

            const finalY = opt.y;
            opt.alpha = 0;
            opt.y = finalY - 900;

            gsap.to(opt, {
                alpha: 1,
                y: finalY,
                duration: 0.7,
                delay: index * 0.12,
                ease: 'bounce.out',
            });
        });
    }

    public async prepare<T>(data?: T) {
        const anyData = data as any;
        if (anyData?.onSelect) this.onSelect = anyData.onSelect;

        // ✅ USE already-loaded config from userSettings.ts
        // If userSettings loads it at app start, this should already be ready here.
        this.config = Config.getConfig();

        // (Optional safety) If somehow it's not loaded yet, fail gracefully.
        if (!this.config) {
            // keep banners hidden, but don't crash
            this.canClickAnywhere = true;
            return;
        }

        this.currencyType = (this.config.currency as CurrencyType) ?? 'US';
        this.currencySymbol = getCurrencySymbol(this.currencyType);

        const features = this.config?.settings.features;

        const realTypeMap: Record<BuyFreeTypeLetter, BuyFreeTypeDefinition> = {
            A: {
                bannerTextureKey: 'green-spin-banner',
                spins: features?.[0]?.spins ?? 0,
                scatters: features?.[0]?.scatters ?? 0,
            },
            B: {
                bannerTextureKey: 'red-spin-banner',
                spins: features?.[1]?.spins ?? 0,
                scatters: features?.[1]?.scatters ?? 0,
            },
            C: {
                bannerTextureKey: 'blue-spin-banner',
                spins: features?.[2]?.spins ?? 0,
                scatters: features?.[2]?.scatters ?? 0,
            },
        };

        this.featureA.setTypeMap(realTypeMap);
        this.featureB.setTypeMap(realTypeMap);
        this.featureC.setTypeMap(realTypeMap);

        // ✅ populate amounts based on CURRENT bet
        this.updateFeatureAmounts();

        this.canClickAnywhere = false;
        this.startLabelPulse();
        this.animateEntrance();

        setTimeout(() => (this.canClickAnywhere = true), 500);
    }

    private updateFeatureAmounts() {
        if (!this.config) return;

        const bet = userSettings.getBet();
        const features = this.config.settings.features as BuyFeature[];
        const banners = [this.featureA, this.featureB, this.featureC];

        features.forEach((feature, index) => {
            const banner = banners[index];

            banner.setAmount(feature.buyFeatureBetMultiplier * bet, 0);

            banner.relayout();
            banner.visible = true;
        });
    }

    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        const isMobile = height > width;

        this.panel.x = width * 0.5;
        this.panel.y = isMobile ? height * 0.46 : height * 0.45;

        if (isMobile) {
            this.exitButton.x = width * 0.88;

            const panelGlobalY = this.panel.y;
            const labelScreenY = panelGlobalY + this.buyLabel.y * this.panel.scale.y;

            this.exitButton.y = labelScreenY - 320;
            this.exitButton.scale.set(1.5);
        } else {
            this.exitButton.x = width * 0.9;
            this.exitButton.y = height * 0.12;
            this.exitButton.scale.set(1.3);
        }

        if (isMobile) {
            this.buyLabel.y = -480;
            this.buyLabel.scale.set(1.35);
        } else {
            this.buyLabel.y = -340;
            this.buyLabel.scale.set(1);
        }

        if (isMobile) {
            const targetWidth = width * 0.95;
            const bannersWidth = 500 * 3;
            this.panel.scale.set(targetWidth / bannersWidth);
        } else {
            this.panel.scale.set(1);
        }

        const spacing = 550;
        const bannerY = isMobile ? 120 : 40;

        if (isMobile) {
            [this.featureA, this.featureB, this.featureC].forEach((f) => {
                f.scale.set(1.25);
                f.setAmountFontSize(68);
                f.setSpinsFontSize(120);
            });
        } else {
            [this.featureA, this.featureB, this.featureC].forEach((f) => {
                f.scale.set(1);
                f.setAmountFontSize(76);
                f.setSpinsFontSize(140);
            });
        }

        this.featureA.x = -spacing;
        this.featureB.x = 0;
        this.featureC.x = spacing;

        this.featureA.y = bannerY;
        this.featureB.y = bannerY;
        this.featureC.y = bannerY;

        this.featureA.relayout();
        this.featureB.relayout();
        this.featureC.relayout();
    }

    public async hide() {
        this.canClickAnywhere = false;
        this.stopLabelPulse();

        const tl = gsap.timeline();
        tl.to(this.panel, { alpha: 0, duration: 0.2 });
        tl.to(this.bg, { alpha: 0, duration: 0.2 }, 0);

        await tl;
        await navigation.dismissPopup();
    }

    // -----------------------
    // Label text helpers (gradient fill + stroke)
    // -----------------------

    private createGradientLabelText(value: string, fontSize: number) {
        this.ensureLabelGradient();

        const style: any = {
            fontFamily: 'Pirata One',
            fontSize,
            align: 'center',
            fill: {
                texture: BuyFreeSpinPopup.labelGradientTexture!,
                matrix: BuyFreeSpinPopup.labelGradientMatrix!,
            },
            stroke: {
                color: 0x4c1b05,
                width: 6,
            },
        };

        const t = new Text(value, style);
        t.anchor.set(0.5);
        t.eventMode = 'none';
        return t;
    }

    private ensureLabelGradient() {
        if (BuyFreeSpinPopup.labelGradientTexture && BuyFreeSpinPopup.labelGradientMatrix) return;

        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext('2d')!;

        // same gradient stops used in FeatureBanner / BuyFreeSpinOptionBanner
        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);
        gradient.addColorStop(0.0, '#FFF39C');
        gradient.addColorStop(0.19, '#FFF39C');
        gradient.addColorStop(0.34, '#FDD44F');
        gradient.addColorStop(0.4, '#FDD44F');
        gradient.addColorStop(0.51, '#FDD44F');
        gradient.addColorStop(1.0, '#D79600');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        BuyFreeSpinPopup.labelGradientTexture = Texture.from(gradientCanvas);

        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);
        BuyFreeSpinPopup.labelGradientMatrix = mat;
    }
}
