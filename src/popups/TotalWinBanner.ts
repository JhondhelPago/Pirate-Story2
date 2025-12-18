import {
    Container,
    Sprite,
    Texture,
    Text,
    Matrix,
    type TextStyle,
} from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

export class TotalWinBanner extends Container {
    public static currentInstance: TotalWinBanner | null = null;

    private static readonly BANNER_BOARD_TEX = "freeSpinTotalWinBoard";

    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;

    // ✅ Header group (both lines animate together)
    private headerGroup!: Container;
    private headerLine1!: Text;
    private headerLine2!: Text;

    // ✅ New: "PRESS ANYWHERE TO CONTINUE"
    private continueText!: Text;

    // ✅ Amount (counting)
    private amountText!: Text;
    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    private canClickAnywhere = false;

    private readonly HEADER_OFFSET_Y = -180;
    private readonly AMOUNT_OFFSET_Y = 40;
    private readonly HEADER_LINE_GAP = 10;

    // ✅ Keyboard handling
    private keyListenerAdded = false;
    private readonly keyDownHandler = (e: KeyboardEvent) => {
        if (!this.canClickAnywhere) return;
        this.hide();
    };

    constructor() {
        super();

        TotalWinBanner.currentInstance = this;

        this.eventMode = "static";
        this.interactiveChildren = true;

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = "static";
        this.addChild(this.bg);

        // 🔹 Close when clicking anywhere (background or panel/children)
        this.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        this.panel = new Container();
        this.addChild(this.panel);

        this.headerGroup = new Container();
        this.panel.addChild(this.headerGroup);
    }

    public static forceDismiss() {
        if (TotalWinBanner.currentInstance) {
            TotalWinBanner.currentInstance.hide(true);
            TotalWinBanner.currentInstance = null;
        }
    }

    public async prepare<T>(data?: T) {
        const anyData = data as any;
        const win = typeof anyData?.win === "number" ? anyData.win : 0;

        this.targetDisplayValue = win;

        // ✅ Ensure fonts are loaded before measuring Text heights
        await this.waitForFonts(["Bangers", "Pirata One"]);

        this.createBanner();
        this.createHeaderText();
        this.createAmountText();
        this.createContinueText();

        this.animateEntrance();
        this.animateHeaderPulse();

        setTimeout(() => this.animateAmount(), 500);

        // ✅ attach keyboard listener once
        if (!this.keyListenerAdded && typeof window !== "undefined") {
            window.addEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = true;
        }

        // ✅ Only allow dismiss after animations settle
        setTimeout(() => {
            this.canClickAnywhere = true;
        }, 1200);

        // ❌ Removed auto-disappear timeout (now only closes on click / key)
        // setTimeout(() => {
        //     if (TotalWinBanner.currentInstance === this && this.canClickAnywhere) {
        //         this.hide();
        //     }
        // }, 4500);
    }

    // ==================================================
    // FONT LOADING (prevents first-render misalignment)
    // ==================================================
    private async waitForFonts(families: string[]) {
        const fontsAny = document as any;
        const fonts = fontsAny?.fonts;
        if (!fonts?.load) return;

        try {
            await Promise.all(families.map((f) => fonts.load(`64px "${f}"`)));
            if (fonts.ready) await fonts.ready;
        } catch {
            // proceed with fallback fonts
        }
    }

    // ==================================================
    // BANNER
    // ==================================================
    private createBanner() {
        if (this.banner) this.banner.destroy();

        this.banner = Sprite.from(TotalWinBanner.BANNER_BOARD_TEX);
        this.banner.anchor.set(0.5);
        this.banner.x = 0;
        this.banner.y = 0;

        this.panel.addChildAt(this.banner, 0);
    }

    // ==================================================
    // HEADER (2 lines)
    // ==================================================
    private createHeaderText() {
        this.headerGroup.removeChildren();

        if (this.headerLine1) this.headerLine1.destroy();
        if (this.headerLine2) this.headerLine2.destroy();

        // Line 1
        this.headerLine1 = new Text("CONGRATULATIONS!", {
            ...this.createHeaderGradientStyle(110),
            fontFamily: "Bangers",
            letterSpacing: 6,
        });
        this.headerLine1.anchor.set(0.5);

        // Line 2
        this.headerLine2 = new Text("YOU HAVE WON", {
            ...this.createSubHeaderGradientStyle(64),
            fontFamily: "Bangers",
            letterSpacing: 4,
        });
        this.headerLine2.anchor.set(0.5);

        this.headerGroup.addChild(this.headerLine1, this.headerLine2);

        this.headerGroup.x = 0;
        this.headerGroup.y = this.HEADER_OFFSET_Y;

        this.layoutHeaderLines();
    }

    private layoutHeaderLines() {
        if (!this.headerLine1 || !this.headerLine2) return;

        this.headerLine1.getBounds();
        this.headerLine2.getBounds();

        this.headerLine1.x = 0;
        this.headerLine1.y = 0;

        const gap = this.HEADER_LINE_GAP;

        this.headerLine2.x = 0;
        this.headerLine2.y =
            this.headerLine1.height * 0.5 +
            gap +
            this.headerLine2.height * 0.5 -
            20;
    }

    // ==================================================
    // AMOUNT
    // ==================================================
    private createAmountText() {
        if (this.amountText) this.amountText.destroy();

        this.amountText = new Text("$0.00", this.createAmountGradientStyle(150));
        this.amountText.anchor.set(0.5);
        this.amountText.x = 0;
        this.amountText.y = this.AMOUNT_OFFSET_Y;

        this.panel.addChild(this.amountText);
    }

    // ==================================================
    // "PRESS ANYWHERE TO CONTINUE"
    // ==================================================
    private createContinueText() {
        if (this.continueText) this.continueText.destroy();

        this.continueText = new Text("PRESS ANYWHERE TO CONTINUE", {
            ...this.createSubHeaderGradientStyle(48),
            fontFamily: "Bangers",
            letterSpacing: 4,
        });
        this.continueText.anchor.set(0.5);
        this.continueText.x = 0;
        this.continueText.y = this.AMOUNT_OFFSET_Y + 150;

        this.panel.addChild(this.continueText);
    }

    // ==================================================
    // GRADIENT STYLES
    // ==================================================
    private createHeaderGradientStyle(fontSize: number): Partial<TextStyle> {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        gradient.addColorStop(0.0, "#ECAC18");
        gradient.addColorStop(0.19, "#FFFFFF");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.4, "#FDD44F");
        gradient.addColorStop(0.51, "#D79600");
        gradient.addColorStop(1.0, "#FF7700");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas);
        const mat = new Matrix();
        mat.scale(1 / canvas.width, 1 / canvas.height);

        return {
            fontFamily: "bangers",
            fontSize,
            align: "center",
            fill: { texture, matrix: mat } as any,
            stroke: { color: 0x0b1d3a, width: 6 },
        };
    }

    private createSubHeaderGradientStyle(fontSize: number): Partial<TextStyle> {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        gradient.addColorStop(0.0, "#ECAC18");
        gradient.addColorStop(0.19, "#FFFFFF");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.4, "#FDD44F");
        gradient.addColorStop(0.51, "#D79600");
        gradient.addColorStop(1.0, "#FF7700");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas);
        const mat = new Matrix();
        mat.scale(1 / canvas.width, 1 / canvas.height);

        return {
            fontFamily: "Bangers",
            fontSize,
            align: "center",
            fill: { texture, matrix: mat } as any,
            stroke: { color: 0x3b1c00, width: 5 },
        };
    }

    private createAmountGradientStyle(fontSize: number): Partial<TextStyle> {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        gradient.addColorStop(0.0, "#FFF39C");
        gradient.addColorStop(0.19, "#FFF39C");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.4, "#FDD44F");
        gradient.addColorStop(0.51, "#FDD44F");
        gradient.addColorStop(1.0, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas);
        const mat = new Matrix();
        mat.scale(1 / canvas.width, 1 / canvas.height);

        return {
            fontFamily: "Pirata One",
            fontSize,
            align: "center",
            fill: { texture, matrix: mat } as any,
            stroke: { color: 0x4c1b05, width: 6 },
        };
    }

    // ==================================================
    // ANIMATIONS
    // ==================================================
    private animateHeaderPulse() {
        gsap.killTweensOf(this.headerGroup.scale);
        if (this.continueText) gsap.killTweensOf(this.continueText.scale);

        this.headerGroup.scale.set(1);
        if (this.continueText) this.continueText.scale.set(1);

        gsap.to(this.headerGroup.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });

        if (this.continueText) {
            gsap.to(this.continueText.scale, {
                x: 1.08,
                y: 1.08,
                duration: 1.2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });
        }
    }

    private animateAmount() {
        this.currentDisplayValue = 0;

        gsap.to(this, {
            currentDisplayValue: this.targetDisplayValue,
            duration: 1.2,
            ease: "power2.out",
            onUpdate: () => {
                this.amountText.text = this.formatCurrency(this.currentDisplayValue);
            },
            onComplete: () => {
                gsap.fromTo(
                    this.amountText.scale,
                    { x: 0.85, y: 0.85 },
                    {
                        x: 1,
                        y: 1,
                        duration: 0.6,
                        ease: "elastic.out(1, 0.6)",
                        onComplete: () => this.animateAmountPulse(),
                    }
                );
            },
        });
    }

    private animateAmountPulse() {
        gsap.killTweensOf(this.amountText.scale);

        this.amountText.scale.set(1);

        gsap.to(this.amountText.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });
    }

    private animateEntrance() {
        gsap.killTweensOf([
            this.banner,
            this.headerGroup,
            this.amountText,
            this.continueText,
        ]);

        const startOffset = -900;

        const bannerY = this.banner.y;
        const headerY = this.headerGroup.y;
        const amountY = this.amountText.y;
        const continueY = this.continueText.y;

        this.banner.alpha = 0;
        this.headerGroup.alpha = 0;
        this.amountText.alpha = 0;
        this.continueText.alpha = 0;

        this.banner.y = bannerY + startOffset;
        this.headerGroup.y = headerY + startOffset;
        this.amountText.y = amountY + startOffset;
        this.continueText.y = continueY + startOffset;

        gsap.to(this.banner, {
            alpha: 1,
            y: bannerY,
            duration: 0.7,
            ease: "bounce.out",
        });

        gsap.to(this.headerGroup, {
            alpha: 1,
            y: headerY,
            duration: 0.7,
            delay: 0.05,
            ease: "bounce.out",
        });

        gsap.to(this.amountText, {
            alpha: 1,
            y: amountY,
            duration: 0.7,
            delay: 0.1,
            ease: "bounce.out",
        });

        gsap.to(this.continueText, {
            alpha: 1,
            y: continueY,
            duration: 0.7,
            delay: 0.15,
            ease: "bounce.out",
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

        this.banner?.scale.set(1.3);
        this.headerGroup?.scale.set(0.9);
        this.amountText?.scale.set(1);

        this.layoutHeaderLines();
    }

    public async hide(forceInstant = false) {
        this.canClickAnywhere = false;

        // 🔻 remove keyboard listener
        if (this.keyListenerAdded && typeof window !== "undefined") {
            window.removeEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = false;
        }

        gsap.killTweensOf(this.headerGroup.scale);
        gsap.killTweensOf(this.amountText.scale);
        if (this.continueText) gsap.killTweensOf(this.continueText.scale);
        gsap.killTweensOf(this);

        if (forceInstant) {
            this.alpha = 0;
            TotalWinBanner.currentInstance = null;
            await navigation.dismissPopup();
            return;
        }

        await gsap.to(
            [this.banner, this.headerGroup, this.amountText, this.continueText, this.bg],
            {
                alpha: 0,
                duration: 0.25,
            }
        );

        TotalWinBanner.currentInstance = null;
        await navigation.dismissPopup();
    }

    public override destroy(options?: any) {
        if (this.keyListenerAdded && typeof window !== "undefined") {
            window.removeEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = false;
        }

        gsap.killTweensOf(this.headerGroup?.scale);
        gsap.killTweensOf(this.amountText?.scale);
        if (this.continueText) gsap.killTweensOf(this.continueText.scale);
        gsap.killTweensOf(this);

        super.destroy(options);

        if (TotalWinBanner.currentInstance === this) {
            TotalWinBanner.currentInstance = null;
        }
    }
}
