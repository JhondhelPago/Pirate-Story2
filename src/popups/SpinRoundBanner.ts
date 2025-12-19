import { Container, Sprite, Texture, Text, Matrix } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

type BannerItem = {
    max: number;
    board: string;
    text: string;
};

export type SpinRoundBannerData = {
    win: number;
    onClosed?: () => void;
};

export class SpinRoundBanner extends Container {
    public static currentInstance: SpinRoundBanner | null = null;

    private bg: Sprite;
    private panel: Container;

    private glow?: Sprite;       // 🔥 glow sprite behind the board
    private banner!: Sprite;
    private headerText!: Sprite;

    private valueText!: Text;
    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    private winValue: number = 0;
    private canClickAnywhere = false;

    private onClosed?: () => void;
    private timeouts: number[] = [];

    private readonly HEADER_OFFSET_Y = -180;
    private readonly HEADER_OFFSET_X = 20;

    constructor() {
        super();

        SpinRoundBanner.currentInstance = this;

        this.eventMode = "static";
        this.interactiveChildren = true;

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = "static";
        this.addChild(this.bg);

        this.bg.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        this.panel = new Container();
        this.addChild(this.panel);
    }

    public static forceDismiss() {
        if (SpinRoundBanner.currentInstance) {
            SpinRoundBanner.currentInstance.hide(true);
            SpinRoundBanner.currentInstance = null;
        }
    }

    public prepare<T>(data?: T) {
        const anyData = data as SpinRoundBannerData;

        this.winValue = anyData?.win ?? 0;
        this.targetDisplayValue = this.winValue;
        this.onClosed = anyData?.onClosed;

        // 1. Banner (position reference)
        // 2. Glow (aligned to banner, behind it)
        // 3. Header + value
        this.createBanner();
        this.createGlow();
        this.createHeaderText();
        this.createValueText();

        this.animateEntrance();
        this.animateHeaderPulse();

        this.timeouts.push(window.setTimeout(() => this.animateValue(), 500));
        this.timeouts.push(window.setTimeout(() => (this.canClickAnywhere = true), 1200));

        this.timeouts.push(
            window.setTimeout(() => {
                if (SpinRoundBanner.currentInstance === this) {
                    if (this.canClickAnywhere) this.hide();
                }
            }, 4500)
        );
    }

    // 🔥 Glow creation – aligned to banner and placed behind it
    private createGlow() {
        if (this.glow) {
            this.glow.removeFromParent();
            this.glow.destroy();
        }

        // IMPORTANT: replace "glow" with your actual texture id if different
        const glowTexture = Texture.from("glow");

        this.glow = new Sprite(glowTexture);
        this.glow.anchor.set(0.5);

        // Same position as the banner
        this.glow.x = this.banner.x;
        this.glow.y = this.banner.y;

        // Make glow clearly bigger than the banner
        // Use banner size to compute a scale factor
        const bannerWidth = this.banner.width;
        const bannerHeight = this.banner.height;

        const targetWidth = bannerWidth * 1.7;
        const targetHeight = bannerHeight * 1.7;

        const scaleX = targetWidth / this.glow.texture.width;
        const scaleY = targetHeight / this.glow.texture.height;
        const finalScale = Math.max(scaleX, scaleY);

        this.glow.scale.set(finalScale);
        this.glow.alpha = 1;

        // Put glow behind banner
        this.panel.addChildAt(this.glow, 0);
    }

    private createBanner() {
        if (this.banner) {
            this.banner.removeFromParent();
            this.banner.destroy();
        }

        const tex = this.getBannerTexture(this.winValue);

        this.banner = Sprite.from(tex.board);
        this.banner.anchor.set(0.5);
        this.banner.x = 0;
        this.banner.y = 0;
        this.banner.visible = true; // ensure the board is visible

        this.panel.addChild(this.banner);
    }

    private createHeaderText() {
        if (this.headerText) {
            this.headerText.removeFromParent();
            this.headerText.destroy();
        }

        const tex = this.getBannerTexture(this.winValue);

        this.headerText = Sprite.from(tex.text);
        this.headerText.anchor.set(0.5);

        this.headerText.x = this.banner.x + this.HEADER_OFFSET_X;
        this.headerText.y = this.banner.y + this.HEADER_OFFSET_Y;

        this.panel.addChild(this.headerText);
    }

    private animateHeaderPulse() {
        gsap.killTweensOf(this.headerText.scale);

        this.headerText.scale.set(1);

        gsap.to(this.headerText.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });
    }

    private createValueText() {
        if (this.valueText) {
            this.valueText.removeFromParent();
            this.valueText.destroy();
        }

        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext("2d")!;

        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);

        gradient.addColorStop(0.0, "#FFF39C");
        gradient.addColorStop(0.19, "#FFF39C");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.4, "#FDD44F");
        gradient.addColorStop(0.51, "#FDD44F");
        gradient.addColorStop(1.0, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        const gradientTexture = Texture.from(gradientCanvas);

        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);

        this.valueText = new Text("$0.00", {
            fontFamily: "Pirata One",
            fontSize: 150,
            align: "center",
            fill: { texture: gradientTexture, matrix: mat },
            stroke: { color: 0x4c1b05, width: 6 },
        });

        this.valueText.anchor.set(0.5);
        this.valueText.x = this.banner.x;
        this.valueText.y = this.banner.y + 40;

        this.panel.addChild(this.valueText);
    }

    private getBannerTexture(win: number): BannerItem {
        const bannerDict: BannerItem[] = [
            { max: 80, board: "green-banner-board", text: "green-banner-text" },
            { max: 150, board: "blue-banner-board", text: "blue-banner-text" },
            { max: Infinity, board: "red-banner-board", text: "red-banner-text" },
        ];

        return bannerDict.find((x) => win < x.max)!;
    }

    private animateEntrance() {
        gsap.killTweensOf([this.banner, this.headerText, this.valueText, this.glow]);

        const startOffset = -900;

        const finalBannerY = this.banner.y;
        const finalHeaderY = this.headerText.y;
        const finalValueY = this.valueText.y;
        const finalGlowY = this.glow ? this.glow.y : 0;

        // Glow
        if (this.glow) {
            this.glow.alpha = 0;
            this.glow.y = finalGlowY + startOffset;
        }

        // Text + banner
        this.banner.alpha = 0;
        this.headerText.alpha = 0;
        this.valueText.alpha = 0;

        this.banner.y = finalBannerY + startOffset;
        this.headerText.y = finalHeaderY + startOffset;
        this.valueText.y = finalValueY + startOffset;

        if (this.glow) {
            gsap.to(this.glow, {
                alpha: 1,
                y: finalGlowY,
                duration: 0.7,
                ease: "bounce.out",
            });
        }

        gsap.to(this.banner, { alpha: 1, y: finalBannerY, duration: 0.7, ease: "bounce.out" });
        gsap.to(this.headerText, {
            alpha: 1,
            y: finalHeaderY,
            duration: 0.7,
            ease: "bounce.out",
            delay: 0.05,
        });
        gsap.to(this.valueText, {
            alpha: 1,
            y: finalValueY,
            duration: 0.7,
            ease: "bounce.out",
            delay: 0.1,
        });
    }

    private animateValue() {
        this.currentDisplayValue = 0;

        gsap.to(this, {
            currentDisplayValue: this.targetDisplayValue,
            duration: 1.2,
            ease: "power2.out",
            onUpdate: () => {
                this.valueText.text = this.formatCurrency(this.currentDisplayValue);
            },
            onComplete: () => {
                gsap.fromTo(
                    this.valueText.scale,
                    { x: 0.85, y: 0.85 },
                    {
                        x: 1,
                        y: 1,
                        duration: 0.6,
                        ease: "elastic.out(1, 0.6)",
                        onComplete: () => this.animateValuePulse(),
                    }
                );
            },
        });
    }

    private animateValuePulse() {
        gsap.killTweensOf(this.valueText.scale);

        this.valueText.scale.set(1);

        gsap.to(this.valueText.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });
    }

    private formatCurrency(value: number): string {
        return "$" + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.banner.scale.set(1.3);
        this.headerText.scale.set(0.9);
        this.valueText.scale.set(1);

        if (this.glow) {
            // Recalculate glow scale to stay larger after resize
            const bannerWidth = this.banner.width;
            const bannerHeight = this.banner.height;

            const targetWidth = bannerWidth * 1.7;
            const targetHeight = bannerHeight * 1.7;

            const scaleX = targetWidth / this.glow.texture.width;
            const scaleY = targetHeight / this.glow.texture.height;
            const finalScale = Math.max(scaleX, scaleY);

            this.glow.scale.set(finalScale);
            this.glow.x = this.banner.x;
            this.glow.y = this.banner.y;
        }
    }

    public async hide(forceInstant = false) {
        this.canClickAnywhere = false;

        for (const t of this.timeouts) clearTimeout(t);
        this.timeouts = [];

        gsap.killTweensOf(this.headerText.scale);
        gsap.killTweensOf(this.valueText.scale);

        if (forceInstant) {
            this.alpha = 0;
            SpinRoundBanner.currentInstance = null;
            await navigation.dismissPopup();

            const cb = this.onClosed;
            this.onClosed = undefined;
            cb?.();
            return;
        }

        await gsap.to(
            [this.banner, this.headerText, this.valueText, this.bg, this.glow].filter(Boolean),
            {
                alpha: 0,
                duration: 0.25,
            }
        );

        SpinRoundBanner.currentInstance = null;
        await navigation.dismissPopup();

        const cb = this.onClosed;
        this.onClosed = undefined;
        cb?.();
    }
}
