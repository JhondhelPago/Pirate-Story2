import { Container, Sprite, Texture, Text, Matrix } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

type BannerItem = {
    max: number;
    board: string;
    text: string;
};

export class SpinRoundBanner extends Container {
    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;
    private headerText!: Sprite;

    private valueText!: Text;
    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    private winValue: number = 0;
    private canClickAnywhere = false;

    private readonly HEADER_OFFSET_Y = -180;
    private readonly HEADER_OFFSET_X = 20;

    constructor() {
        super();
        this.eventMode = "static";
        this.interactiveChildren = true;

        // Background
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

    public prepare<T>(data?: T) {
        const anyData = data as any;
        this.winValue = anyData?.win ?? 0;
        this.targetDisplayValue = this.winValue;

        this.createBanner();
        this.createHeaderText();
        this.createValueText();

        this.animateEntrance();

        setTimeout(() => this.animateValue(), 500);
        setTimeout(() => (this.canClickAnywhere = true), 1200);
    }

    private createBanner() {
        if (this.banner) this.banner.destroy();

        const tex = this.getBannerTexture(this.winValue);

        this.banner = Sprite.from(tex.board);
        this.banner.anchor.set(0.5);
        this.banner.x = 0;
        this.banner.y = 0;

        this.panel.addChild(this.banner);
    }

    private createHeaderText() {
        if (this.headerText) this.headerText.destroy();

        const tex = this.getBannerTexture(this.winValue);

        this.headerText = Sprite.from(tex.text);
        this.headerText.anchor.set(0.5);

        this.headerText.x = this.banner.x + this.HEADER_OFFSET_X;
        this.headerText.y = this.banner.y + this.HEADER_OFFSET_Y;

        this.panel.addChild(this.headerText);
    }

    // ==================================================
    // ⭐ VALUE TEXT (Pixi v8 gradient + matrix fix)
    // ==================================================
    private createValueText() {
        if (this.valueText) this.valueText.destroy();

        // ---- Create gradient canvas ----
        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext("2d")!;

        const gradient = ctx.createLinearGradient(0, 0, gradientCanvas.width, 0);

        gradient.addColorStop(0.00, "#FFF39C");
        gradient.addColorStop(0.19, "#FFF39C");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.40, "#FDD44F");
        gradient.addColorStop(0.51, "#FDD44F");
        gradient.addColorStop(1.00, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        const gradientTexture = Texture.from(gradientCanvas);

        // ⭐ Matrix required for Pixi v8 text texture fill
        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);

        this.valueText = new Text("$0.00", {
            fontFamily: "Pirata One",
            fontSize: 150,
            align: "center",

            fill: {
                texture: gradientTexture,
                matrix: mat
            },

            stroke: {
                color: 0x4C1B05,
                width: 6
            }
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
            { max: Infinity, board: "red-banner-board", text: "red-banner-text" }
        ];
        return bannerDict.find(x => win < x.max)!;
    }

    private animateEntrance() {
        gsap.killTweensOf([this.banner, this.headerText, this.valueText]);

        const startOffset = -900;

        const finalBannerY = this.banner.y;
        const finalHeaderY = this.headerText.y;
        const finalValueY = this.valueText.y;

        this.banner.alpha = 0;
        this.headerText.alpha = 0;
        this.valueText.alpha = 0;

        this.banner.y = finalBannerY + startOffset;
        this.headerText.y = finalHeaderY + startOffset;
        this.valueText.y = finalValueY + startOffset;

        gsap.to(this.banner, {
            alpha: 1, y: finalBannerY, duration: 0.7, ease: "bounce.out"
        });

        gsap.to(this.headerText, {
            alpha: 1, y: finalHeaderY, duration: 0.7, ease: "bounce.out", delay: 0.05
        });

        gsap.to(this.valueText, {
            alpha: 1, y: finalValueY, duration: 0.7, ease: "bounce.out", delay: 0.1
        });
    }

    // ==================================================
    // ⭐ NUMBER COUNT-UP ANIMATION with $ and commas
    // ==================================================
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
                gsap.fromTo(this.valueText.scale,
                    { x: 0.85, y: 0.85 },
                    {
                        x: 1,
                        y: 1,
                        duration: 0.6,
                        ease: "elastic.out(1, 0.6)"
                    }
                );
            }
        });
    }

    // ⭐ "$10,000.00" formatter
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
    }

    public async hide() {
        this.canClickAnywhere = false;

        await gsap.to([this.banner, this.headerText, this.valueText, this.bg], {
            alpha: 0,
            duration: 0.25,
        });

        await navigation.dismissPopup();
    }
}
