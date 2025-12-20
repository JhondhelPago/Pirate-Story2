import { Container, Sprite, Texture } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";
import { ConfirmationBuyFreeSpinPopup } from "./BuyFreeConfirmationPopup";
import { GameScreen } from "../screens/GameScreen";
import { userSettings } from "../utils/userSettings";
import { ConfigAPI } from "../api/configApi";

const config = await ConfigAPI.config();

// ✅ updated imports (letter type)
import {
    BuyFreeSpinOptionBanner,
    type BuyFreeTypeLetter,
} from "../ui/FeatureBanner";

export class BuyFreeSpinPopup extends Container {
    private bg: Sprite;
    private panel: Container;

    private buyLabel: Sprite;

    // (names kept for minimal refactor)
    private featureA: BuyFreeSpinOptionBanner;
    private featureB: BuyFreeSpinOptionBanner;
    private featureC: BuyFreeSpinOptionBanner;

    private exitButton: Sprite;

    private canClickAnywhere = false;
    private onSelect?: (value: string) => void; // ✅ now letter

    private pulseTween?: gsap.core.Tween;

    constructor() {
        super();
        this.eventMode = "static";
        this.interactiveChildren = true;

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = "static";
        this.addChild(this.bg);

        this.panel = new Container();
        this.addChild(this.panel);

        this.buyLabel = Sprite.from("buy-free-spin-label");
        this.buyLabel.anchor.set(0.5);
        this.panel.addChild(this.buyLabel);

        // ✅ reusable options now use typeLetter A/B/C
        this.featureA = new BuyFreeSpinOptionBanner({
            typeLetter: "A",
            amount: config.feature.A.buyFeatureBetMultiplier * userSettings.getBet(),
            currencySymbol: "$",
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        this.featureB = new BuyFreeSpinOptionBanner({
            typeLetter: "B",
            amount: config.feature.B.buyFeatureBetMultiplier * userSettings.getBet(),
            currencySymbol: "$",
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        this.featureC = new BuyFreeSpinOptionBanner({
            typeLetter: "C",
            amount: config.feature.C.buyFeatureBetMultiplier * userSettings.getBet(),
            currencySymbol: "$",
            decimals: 0,
            amountFontSize: 76,
            spinsFontSize: 140,
        });

        const optionList = [this.featureA, this.featureB, this.featureC];
        for (const opt of optionList) {
            this.panel.addChild(opt);
        }

        // ✅ tap handlers now derive spins from the banner itself
        this.featureA.setOnTap(() => {
            const amount = 100 * userSettings.getBet();
            this.openConfirm("A", amount, this.featureA.getSpins());
        });

        this.featureB.setOnTap(() => {
            const amount = 500 * userSettings.getBet();
            this.openConfirm("B", amount, this.featureB.getSpins());
        });

        this.featureC.setOnTap(() => {
            const amount = 1000 * userSettings.getBet();
            this.openConfirm("C", amount, this.featureC.getSpins());
        });

        this.bg.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        this.exitButton = Sprite.from("cancel-button");
        this.exitButton.anchor.set(0.5);
        this.exitButton.scale.set(1.3);
        this.exitButton.eventMode = "static";
        this.exitButton.cursor = "pointer";
        this.addChild(this.exitButton);

        this.exitButton.on("pointerover", () => {
            gsap.to(this.exitButton.scale, { x: 1.1, y: 1.1, duration: 0.15 });
        });
        this.exitButton.on("pointerout", () => {
            gsap.to(this.exitButton.scale, { x: 1, y: 1, duration: 0.15 });
        });
        this.exitButton.on("pointertap", () => {
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

    private openConfirm(typeLetter: BuyFreeTypeLetter, amount: number, spinCount: number) {
        this.onSelect?.(typeLetter);

        navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
            confirmationBoard: "buy-spin-confirm-board",

            // ✅ NEW
            spins: spinCount,

            amount,
            currencySymbol: "$",
            decimals: 0,
            confirmButton: "confirm-button",
            cancelButton: "cancel-button",
            onConfirm: () => {
                const game = navigation.currentScreen as GameScreen;
                game.freeSpinStartSpinning(spinCount);
            },
        });
    }


    public setOptionAmounts(
        vA: number,
        vB: number,
        vC: number,
        currencySymbol = "$",
        decimals = 0
    ) {
        this.featureA.setAmount(vA, currencySymbol, decimals);
        this.featureB.setAmount(vB, currencySymbol, decimals);
        this.featureC.setAmount(vC, currencySymbol, decimals);

        this.featureA.relayout();
        this.featureB.relayout();
        this.featureC.relayout();
    }

    private startLabelPulse() {
        gsap.killTweensOf(this.buyLabel.scale);

        this.pulseTween = gsap.to(this.buyLabel.scale, {
            x: 1.05,
            y: 1.05,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
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
                ease: "bounce.out",
            });
        });
    }

    public prepare<T>(data?: T) {
        const anyData = data as any;
        if (anyData?.onSelect) this.onSelect = anyData.onSelect;

        this.canClickAnywhere = false;

        this.startLabelPulse();
        this.animateEntrance();

        setTimeout(() => (this.canClickAnywhere = true), 500);
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
        this.buyLabel.x = 0;

        if (isMobile) {
            const targetWidth = width * 0.95;
            const bannersWidth = 500 * 3;
            const scale = targetWidth / bannersWidth;
            this.panel.scale.set(scale);
        } else {
            this.panel.scale.set(1);
        }

        const spacing = 550;
        const bannerY = isMobile ? 120 : 40;

        if (isMobile) {
            this.featureA.scale.set(1.25);
            this.featureB.scale.set(1.25);
            this.featureC.scale.set(1.25);

            this.featureA.setAmountFontSize(68);
            this.featureB.setAmountFontSize(68);
            this.featureC.setAmountFontSize(68);

            // ✅ center spins can shrink too on mobile
            this.featureA.setSpinsFontSize(120);
            this.featureB.setSpinsFontSize(120);
            this.featureC.setSpinsFontSize(120);
        } else {
            this.featureA.scale.set(1);
            this.featureB.scale.set(1);
            this.featureC.scale.set(1);

            this.featureA.setAmountFontSize(76);
            this.featureB.setAmountFontSize(76);
            this.featureC.setAmountFontSize(76);

            this.featureA.setSpinsFontSize(140);
            this.featureB.setSpinsFontSize(140);
            this.featureC.setSpinsFontSize(140);
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
}
