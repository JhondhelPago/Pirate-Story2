import { Container, Sprite, Texture, Text, Matrix } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";
import { ConfirmationBuyFreeSpinPopup } from "./BuyFreeConfirmationPopup";
import { GameScreen } from "../screens/GameScreen";
import { userSettings } from "../utils/userSettings"; 

export class BuyFreeSpinPopup extends Container {
    private bg: Sprite;
    private panel: Container;

    private buyLabel: Sprite;
    private option10: Sprite;
    private option15: Sprite;
    private option20: Sprite;

    private option10AmountText!: Text;
    private option15AmountText!: Text;
    private option20AmountText!: Text;

    private exitButton: Sprite;

    private canClickAnywhere = false;
    private onSelect?: (value: number) => void;

    private pulseTween?: gsap.core.Tween;

    private amountGradientTexture?: Texture;
    private amountGradientMatrix?: Matrix;

    private fontReady = false;
    private pirataLoadPromise: Promise<void> | null = null;

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

        this.option10 = Sprite.from("10-spin-banner");
        this.option15 = Sprite.from("15-spin-banner");
        this.option20 = Sprite.from("20-spin-banner");

        // Create texts using a safe fallback first (so first render is stable),
        // then swap to Pirata One once it’s definitely loaded.
        this.option10AmountText = this.createAmountText(100 * userSettings.getBet(), "$", 0);
        this.option15AmountText = this.createAmountText(500 * userSettings.getBet(), "$", 0);
        this.option20AmountText = this.createAmountText(1000 * userSettings.getBet(), "$", 0);

        this.attachAmountTextToOption(this.option10, this.option10AmountText);
        this.attachAmountTextToOption(this.option15, this.option15AmountText);
        this.attachAmountTextToOption(this.option20, this.option20AmountText);

        const optionList = [this.option10, this.option15, this.option20];
        for (const s of optionList) {
            s.anchor.set(0.5);
            s.eventMode = "static";
            s.cursor = "pointer";
            this.panel.addChild(s);

            s.on("pointerover", () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, { x: 1.08, y: 1.08, duration: 0.15 });
            });
            s.on("pointerout", () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, { x: 1, y: 1, duration: 0.15 });
            });

            s.on("pointertap", () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, {
                    x: 1.2,
                    y: 1.2,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                });

                if (s === this.option10) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-10-label",
                        amount: 100 * userSettings.getBet(),
                        currencySymbol: "$",
                        decimals: 0,
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            game.freeSpinStartSpinning(5);
                        },
                    });
                } else if (s === this.option15) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-15-label",
                        amount: 500 * userSettings.getBet(),
                        currencySymbol: "$",
                        decimals: 0,
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            game.freeSpinStartSpinning(15);
                        },
                    });
                } else if (s === this.option20) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-20-label",
                        amount: 1000 * userSettings.getBet(),
                        currencySymbol: "$",
                        decimals: 0,
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            game.freeSpinStartSpinning(20);
                        },
                    });
                }
            });
        }

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

        this.ensurePirataOneLoaded();
    }

    public setOptionAmounts(
        v10: number,
        v15: number,
        v20: number,
        currencySymbol = "$",
        decimals = 0
    ) {
        this.option10AmountText.text = this.formatAmount(v10, currencySymbol, decimals);
        this.option15AmountText.text = this.formatAmount(v15, currencySymbol, decimals);
        this.option20AmountText.text = this.formatAmount(v20, currencySymbol, decimals);

        this.attachAmountTextToOption(this.option10, this.option10AmountText);
        this.attachAmountTextToOption(this.option15, this.option15AmountText);
        this.attachAmountTextToOption(this.option20, this.option20AmountText);
    }

    private createAmountText(amount: number, currencySymbol = "$", decimals = 0) {
        this.ensureAmountGradient();

        const style: any = {
            fontFamily: this.fontReady ? "Pirata One" : "Arial",
            fontSize: 86,
            align: "center",
            fill: {
                texture: this.amountGradientTexture!,
                matrix: this.amountGradientMatrix!,
            },
            stroke: {
                color: 0x4c1b05,
                width: 6,
            },
        };

        const t = new Text(this.formatAmount(amount, currencySymbol, decimals), style);
        t.anchor.set(0.5);
        t.eventMode = "none";
        return t;
    }

    private formatAmount(amount: number, currencySymbol: string, decimals: number) {
        return `${currencySymbol}${amount.toFixed(decimals)}`;
    }

    private ensureAmountGradient() {
        if (this.amountGradientTexture && this.amountGradientMatrix) return;

        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext("2d")!;

        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);
        gradient.addColorStop(0.0, "#FFF39C");
        gradient.addColorStop(0.19, "#FFF39C");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.40, "#FDD44F");
        gradient.addColorStop(0.51, "#FDD44F");
        gradient.addColorStop(1.0, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        this.amountGradientTexture = Texture.from(gradientCanvas);

        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);
        this.amountGradientMatrix = mat;
    }

    private attachAmountTextToOption(optionSprite: Sprite, text: Text) {
        if (text.parent !== optionSprite) optionSprite.addChild(text);

        const texH =
            optionSprite.texture?.orig?.height ??
            optionSprite.texture?.height ??
            optionSprite.height;

        const bottomPadding = 14;

        text.x = 0;
        text.y = texH * 0.3 - bottomPadding;
    }

    private ensurePirataOneLoaded() {
        if (this.pirataLoadPromise) return this.pirataLoadPromise;

        this.pirataLoadPromise = (async () => {
            try {
                const fonts: any = (document as any).fonts;
                if (!fonts?.load) {
                    this.fontReady = true;
                    this.applyPirataOneToTexts();
                    return;
                }

                // Load multiple sizes to reduce “first render not Pirata One” issues
                await Promise.all([
                    fonts.load(`48px "Pirata One"`),
                    fonts.load(`68px "Pirata One"`),
                    fonts.load(`76px "Pirata One"`),
                ]);
                await fonts.ready;

                this.fontReady = true;
                this.applyPirataOneToTexts();
            } catch {
                // ignore
            }
        })();

        return this.pirataLoadPromise;
    }

    private applyPirataOneToTexts() {
        const texts = [this.option10AmountText, this.option15AmountText, this.option20AmountText];

        for (const t of texts) {
            if (!t) continue;

            // Force a rebuild: set style + nudge text to trigger internal update reliably
            (t.style as any).fontFamily = "Pirata One";
            t.text = `${t.text} `;
            t.text = t.text.trimEnd();
        }

        this.attachAmountTextToOption(this.option10, this.option10AmountText);
        this.attachAmountTextToOption(this.option15, this.option15AmountText);
        this.attachAmountTextToOption(this.option20, this.option20AmountText);
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
        const options = [this.option10, this.option15, this.option20];

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
            this.option10.scale.set(1.25);
            this.option15.scale.set(1.25);
            this.option20.scale.set(1.25);

            this.option10AmountText.style.fontSize = 68;
            this.option15AmountText.style.fontSize = 68;
            this.option20AmountText.style.fontSize = 68;
        } else {
            this.option10.scale.set(1);
            this.option15.scale.set(1);
            this.option20.scale.set(1);

            this.option10AmountText.style.fontSize = 76;
            this.option15AmountText.style.fontSize = 76;
            this.option20AmountText.style.fontSize = 76;
        }

        // If size changed, re-load font at this size (helps some browsers)
        this.ensurePirataOneLoaded();

        this.option10.x = -spacing;
        this.option15.x = 0;
        this.option20.x = spacing;

        this.option10.y = bannerY;
        this.option15.y = bannerY;
        this.option20.y = bannerY;

        this.attachAmountTextToOption(this.option10, this.option10AmountText);
        this.attachAmountTextToOption(this.option15, this.option15AmountText);
        this.attachAmountTextToOption(this.option20, this.option20AmountText);
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
