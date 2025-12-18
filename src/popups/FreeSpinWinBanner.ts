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

export type FreeSpinWinBannerData = {
    spins: number;
    topText?: string;
    bottomText?: string;
    onClosed?: () => void;
};

export class FreeSpinWinBanner extends Container {
    public static currentInstance: FreeSpinWinBanner | null = null;

    // 🔧 set this to your real texture key
    private static readonly BANNER_BOARD_TEX = "freeSpinWinBoard";

    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;
    private topText!: Text;
    private bottomText!: Text;
    private spinsText!: Text;

    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    private canClickAnywhere = false;
    private onClosed?: () => void;

    // layout (tuned for your Figma)
    private readonly TOP_TEXT_Y = -160;
    private readonly CENTER_NUMBER_Y = -5;
    private readonly BOTTOM_TEXT_Y = 155;

    constructor() {
        super();

        FreeSpinWinBanner.currentInstance = this;

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

    // ==================================================
    // PREPARE
    // ==================================================
    public async prepare<T>(data?: T) {
        const d = data as any as FreeSpinWinBannerData;

        this.targetDisplayValue = Math.max(0, Math.floor(d?.spins ?? 0));
        this.onClosed = d?.onClosed;

        const topLabel = d?.topText ?? "YOU HAVE WON";
        const bottomLabel = d?.bottomText ?? "FREE SPINS";

        await this.waitForFonts(["Bangers", "Pirata One"]);

        this.createBanner();
        this.createWoodTexts(topLabel, bottomLabel);
        this.createCenterNumber();

        this.animateEntrance();
        this.animateWoodPulse();

        setTimeout(() => this.animateNumber(), 350);
        setTimeout(() => (this.canClickAnywhere = true), 900);

        setTimeout(() => {
            if (FreeSpinWinBanner.currentInstance === this && this.canClickAnywhere) {
                this.hide();
            }
        }, 4500);
    }

    // ==================================================
    // FONT LOADING
    // ==================================================
    private async waitForFonts(families: string[]) {
        const fontsAny = document as any;
        const fonts = fontsAny?.fonts;
        if (!fonts?.load) return;

        try {
            await Promise.all(families.map((f) => fonts.load(`64px "${f}"`)));
            if (fonts.ready) await fonts.ready;
        } catch {}
    }

    // ==================================================
    // BUILD
    // ==================================================
    private createBanner() {
        this.banner?.destroy();
        this.banner = Sprite.from(FreeSpinWinBanner.BANNER_BOARD_TEX);
        this.banner.anchor.set(0.5);
        this.panel.addChildAt(this.banner, 0);
    }

    private createWoodTexts(topLabel: string, bottomLabel: string) {
        this.topText?.destroy();
        this.bottomText?.destroy();

        this.topText = new Text(topLabel, {
            ...this.createWoodLabelStyle(42),
            fontFamily: "Bangers",
            letterSpacing: 3,
        });
        this.topText.anchor.set(0.5);
        this.topText.y = this.TOP_TEXT_Y;

        this.bottomText = new Text(bottomLabel, {
            ...this.createWoodLabelStyle(44),
            fontFamily: "Bangers",
            letterSpacing: 3,
        });
        this.bottomText.anchor.set(0.5);
        this.bottomText.y = this.BOTTOM_TEXT_Y;

        this.panel.addChild(this.topText, this.bottomText);
    }

    private createCenterNumber() {
        this.spinsText?.destroy();

        this.spinsText = new Text("0", {
            ...this.createCenterNumberStyle(150),
            fontFamily: "Pirata One",
            letterSpacing: 2,
        });
        this.spinsText.anchor.set(0.5);
        this.spinsText.y = this.CENTER_NUMBER_Y;

        this.panel.addChild(this.spinsText);
    }

    // ==================================================
    // STYLES
    // ==================================================
    private createWoodLabelStyle(fontSize: number): Partial<TextStyle> {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        gradient.addColorStop(0.0, "#FFF3A0");
        gradient.addColorStop(0.35, "#FDD44F");
        gradient.addColorStop(0.7, "#D79600");
        gradient.addColorStop(1.0, "#FF7A00");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas);
        const mat = new Matrix();
        mat.scale(1 / canvas.width, 1 / canvas.height);

        return {
            fontSize,
            align: "center",
            fill: { texture, matrix: mat } as any,
            stroke: { color: 0x3b1c00, width: 6 },
        };
    }

    private createCenterNumberStyle(fontSize: number): Partial<TextStyle> {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

        gradient.addColorStop(0.0, "#FFF39C");
        gradient.addColorStop(0.25, "#FFFFFF");
        gradient.addColorStop(0.55, "#FDD44F");
        gradient.addColorStop(1.0, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = Texture.from(canvas);
        const mat = new Matrix();
        mat.scale(1 / canvas.width, 1 / canvas.height);

        return {
            fontSize,
            align: "center",
            fill: { texture, matrix: mat } as any,
            stroke: { color: 0x4c1b05, width: 10 },
        };
    }

    // ==================================================
    // ANIMATIONS
    // ==================================================
    private animateEntrance() {
        const startOffset = -900;
        const items = [this.banner, this.topText, this.spinsText, this.bottomText];

        items.forEach((i) => {
            i.alpha = 0;
            i.y += startOffset;
        });

        items.forEach((i, idx) => {
            gsap.to(i, {
                alpha: 1,
                y: i.y - startOffset,
                duration: 0.7,
                delay: idx * 0.05,
                ease: "bounce.out",
            });
        });
    }

    private animateWoodPulse() {
        gsap.to([this.topText.scale, this.bottomText.scale], {
            x: 1.06,
            y: 1.06,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });
    }

    private animateNumber() {
        this.currentDisplayValue = 0;

        gsap.to(this, {
            currentDisplayValue: this.targetDisplayValue,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
                this.spinsText.text = String(Math.floor(this.currentDisplayValue));
            },
            onComplete: () => {
                gsap.fromTo(
                    this.spinsText.scale,
                    { x: 0.85, y: 0.85 },
                    { x: 1, y: 1, duration: 0.6, ease: "elastic.out(1, 0.6)" }
                );
            },
        });
    }

    // ==================================================
    // RESIZE / HIDE
    // ==================================================
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.banner?.scale.set(1.3);
    }

    public async hide(forceInstant = false) {
        this.canClickAnywhere = false;

        if (forceInstant) {
            this.alpha = 0;
            const cb = this.onClosed;
            FreeSpinWinBanner.currentInstance = null;
            await navigation.dismissPopup();
            cb?.();
            return;
        }

        await gsap.to([this.banner, this.topText, this.spinsText, this.bottomText, this.bg], {
            alpha: 0,
            duration: 0.25,
        });

        const cb = this.onClosed;
        FreeSpinWinBanner.currentInstance = null;
        await navigation.dismissPopup();
        cb?.();
    }
}
