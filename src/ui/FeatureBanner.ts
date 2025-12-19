import { Container, Sprite, Texture, Text, Matrix } from "pixi.js";
import gsap from "gsap";

export type BuyFreeTypeLetter = "A" | "B" | "C";

export type BuyFreeTypeDefinition = {
    bannerTextureKey: string; // e.g. "10-spin-banner"
    spins: number;            // e.g. 10
    scatters: number;         // e.g. 3
};

export type BuyFreeSpinOptionBannerConfig = {
    typeLetter: BuyFreeTypeLetter;
    amount: number;
    currencySymbol?: string;
    decimals?: number;

    // mapping for A/B/C
    typeMap?: Partial<Record<BuyFreeTypeLetter, BuyFreeTypeDefinition>>;

    // sizes (popup can override per mobile/desktop)
    amountFontSize?: number;     // bottom price
    spinsFontSize?: number;      // big center number
    labelFontSize?: number;      // "FREE SPINS" + "X SCATTERS"
};

export class BuyFreeSpinOptionBanner extends Container {
    public sprite: Sprite;

    private amountText: Text;
    private spinsText: Text;

    // ✅ two-line label:
    // line 1: FREE SPINS (gradient)
    // line 2: X (white) + SCATTERS (gradient)
    private freeSpinsText: Text;
    private scattersLine: Container;
    private scattersNumberText: Text;
    private scattersWordText: Text;

    private typeLetter: BuyFreeTypeLetter;
    private amount: number;
    private currencySymbol: string;
    private decimals: number;

    private fontReady = false;
    private fontLoadPromise: Promise<void> | null = null;

    // cache gradient for all instances
    private static amountGradientTexture?: Texture;
    private static amountGradientMatrix?: Matrix;

    private onTap?: () => void;

    private typeMap: Record<BuyFreeTypeLetter, BuyFreeTypeDefinition>;

    constructor(cfg: BuyFreeSpinOptionBannerConfig) {
        super();

        this.typeLetter = cfg.typeLetter;
        this.amount = cfg.amount;
        this.currencySymbol = cfg.currencySymbol ?? "$";
        this.decimals = cfg.decimals ?? 0;

        // ✅ default mapping (edit if your scatters differ)
        this.typeMap = {
            A: { bannerTextureKey: "green-spin-banner", spins: 10, scatters: 3 },
            B: { bannerTextureKey: "red-spin-banner", spins: 15, scatters: 4 },
            C: { bannerTextureKey: "blue-spin-banner", spins: 20, scatters: 5 },
            ...(cfg.typeMap as any),
        };

        const def = this.typeMap[this.typeLetter];

        this.sprite = Sprite.from(def.bannerTextureKey);
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);

        // --- center block texts ---
        this.spinsText = this.createStyledText(`${def.spins}`, cfg.spinsFontSize ?? 140, "Pirata One");

        const labelSize = cfg.labelFontSize ?? 54;

        // LINE 1
        this.freeSpinsText = this.createStyledText("FREE SPINS", labelSize, "Bangers");

        // LINE 2 (container to center nicely)
        this.scattersLine = new Container();
        this.scattersLine.eventMode = "none";

        this.scattersNumberText = this.createStyledText(`${def.scatters}`, labelSize, "Bangers");
        this.scattersWordText = this.createStyledText(" SCATTERS", labelSize, "Bangers");

        // ✅ number only = white (no gradient)
        (this.scattersNumberText.style as any).fill = 0xffffff;

        this.scattersLine.addChild(this.scattersNumberText, this.scattersWordText);

        this.attachCenterTextsToBanner(this.sprite);

        // --- bottom amount ---
        this.amountText = this.createStyledText(
            this.formatAmount(this.amount, this.currencySymbol, this.decimals),
            cfg.amountFontSize ?? 76,
            "Pirata One"
        );
        this.attachAmountTextToBanner(this.sprite, this.amountText);

        // interactions
        this.eventMode = "static";
        this.cursor = "pointer";

        this.on("pointerover", () => {
            gsap.killTweensOf(this.scale);
            gsap.to(this.scale, { x: 1.08, y: 1.08, duration: 0.15 });
        });

        this.on("pointerout", () => {
            gsap.killTweensOf(this.scale);
            gsap.to(this.scale, { x: 1, y: 1, duration: 0.15 });
        });

        this.on("pointertap", () => {
            gsap.killTweensOf(this.scale);
            gsap.to(this.scale, { x: 1.2, y: 1.2, duration: 0.1, yoyo: true, repeat: 1 });
            this.onTap?.();
        });

        // load fonts used by this banner
        this.ensureFontsLoaded();
    }

    /** external: set tap handler */
    public setOnTap(fn?: () => void) {
        this.onTap = fn;
    }

    /** external: returns the spins for this letter */
    public getSpins(): number {
        return this.typeMap[this.typeLetter].spins;
    }

    /** external: update amount */
    public setAmount(amount: number, currencySymbol = this.currencySymbol, decimals = this.decimals) {
        this.amount = amount;
        this.currencySymbol = currencySymbol;
        this.decimals = decimals;

        this.amountText.text = this.formatAmount(amount, currencySymbol, decimals);
        this.attachAmountTextToBanner(this.sprite, this.amountText);
    }

    /** external: update type letter (changes sprite + center texts) */
    public setTypeLetter(typeLetter: BuyFreeTypeLetter) {
        this.typeLetter = typeLetter;

        const def = this.typeMap[this.typeLetter];
        this.sprite.texture = Texture.from(def.bannerTextureKey);

        this.spinsText.text = `${def.spins}`;
        this.scattersNumberText.text = `${def.scatters}`;

        this.relayout();
    }

    /** external: adjust bottom amount font size */
    public setAmountFontSize(fontSize: number) {
        (this.amountText.style as any).fontSize = fontSize;
        this.attachAmountTextToBanner(this.sprite, this.amountText);
        this.ensureFontsLoaded();
    }

    /** external: adjust center spins font size */
    public setSpinsFontSize(fontSize: number) {
        (this.spinsText.style as any).fontSize = fontSize;
        this.attachCenterTextsToBanner(this.sprite);
        this.ensureFontsLoaded();
    }

    /** optional: adjust label size (both lines) */
    public setCenterLabelFontSize(labelFontSize: number) {
        (this.freeSpinsText.style as any).fontSize = labelFontSize;
        (this.scattersNumberText.style as any).fontSize = labelFontSize;
        (this.scattersWordText.style as any).fontSize = labelFontSize;

        // keep number white
        (this.scattersNumberText.style as any).fill = 0xffffff;

        this.attachCenterTextsToBanner(this.sprite);
        this.ensureFontsLoaded();
    }

    /** external: call after scale changes / resize */
    public relayout() {
        this.attachCenterTextsToBanner(this.sprite);
        this.attachAmountTextToBanner(this.sprite, this.amountText);
    }

    // -----------------------
    // Text helpers (same gradient system)
    // -----------------------

    private createStyledText(value: string, fontSize: number, fontFamily: "Pirata One" | "Bangers") {
        this.ensureAmountGradient();

        const style: any = {
            fontFamily: this.fontReady ? fontFamily : "Arial",
            fontSize,
            align: "center",
            fill: {
                texture: BuyFreeSpinOptionBanner.amountGradientTexture!,
                matrix: BuyFreeSpinOptionBanner.amountGradientMatrix!,
            },
            stroke: {
                color: 0x4c1b05,
                width: 6,
            },
        };

        const t = new Text(value, style);
        t.anchor.set(0.5);
        t.eventMode = "none";
        return t;
    }

    private formatAmount(amount: number, currencySymbol: string, decimals: number) {
        return `${currencySymbol}${amount.toFixed(decimals)}`;
    }

    private ensureAmountGradient() {
        if (BuyFreeSpinOptionBanner.amountGradientTexture && BuyFreeSpinOptionBanner.amountGradientMatrix) return;

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

        BuyFreeSpinOptionBanner.amountGradientTexture = Texture.from(gradientCanvas);

        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);
        BuyFreeSpinOptionBanner.amountGradientMatrix = mat;
    }

    // -----------------------
    // Layout
    // -----------------------

    private attachAmountTextToBanner(optionSprite: Sprite, text: Text) {
        if (text.parent !== optionSprite) optionSprite.addChild(text);

        const texH =
            optionSprite.texture?.orig?.height ??
            optionSprite.texture?.height ??
            optionSprite.height;

        const bottomPadding = 14;

        text.x = 0;
        text.y = texH * 0.3 - bottomPadding;
    }

    /**
     * ✅ Places:
     *  - big spins number
     *  - line1: FREE SPINS
     *  - line2: X SCATTERS
     * inside a middle safe band
     */
    private attachCenterTextsToBanner(optionSprite: Sprite) {
        const texH =
            optionSprite.texture?.orig?.height ??
            optionSprite.texture?.height ??
            optionSprite.height;

        if (this.spinsText.parent !== optionSprite) optionSprite.addChild(this.spinsText);
        if (this.freeSpinsText.parent !== optionSprite) optionSprite.addChild(this.freeSpinsText);
        if (this.scattersLine.parent !== optionSprite) optionSprite.addChild(this.scattersLine);

        const safeTop = -texH * 0.18;
        const safeBottom = texH * 0.18;
        const safeHeight = safeBottom - safeTop;

        // ✅ slightly adjusted spacing (cleaner line gap)
        const ySpins = safeTop + safeHeight * 0.08;
        const yFree = safeTop + safeHeight * 0.62;
        const yScat = safeTop + safeHeight * 0.90;

        this.spinsText.x = 0;
        this.spinsText.y = ySpins;

        this.freeSpinsText.x = 0;
        this.freeSpinsText.y = yFree;

        // center "X SCATTERS" as a group
        this.scattersNumberText.anchor.set(0, 0.5);
        this.scattersWordText.anchor.set(0, 0.5);

        const w1 = this.scattersNumberText.width;
        const w2 = this.scattersWordText.width;
        const total = w1 + w2;

        this.scattersNumberText.x = -total / 2;
        this.scattersWordText.x = this.scattersNumberText.x + w1;

        this.scattersNumberText.y = 0;
        this.scattersWordText.y = 0;

        this.scattersLine.x = 0;
        this.scattersLine.y = yScat;

        // keep number white
        (this.scattersNumberText.style as any).fill = 0xffffff;
    }

    // -----------------------
    // Font loading
    // -----------------------

    private ensureFontsLoaded() {
        if (this.fontLoadPromise) return this.fontLoadPromise;

        this.fontLoadPromise = (async () => {
            try {
                const fonts: any = (document as any).fonts;
                if (!fonts?.load) {
                    this.fontReady = true;
                    this.applyFontsToTexts();
                    return;
                }

                await Promise.all([
                    // Pirata One (spins + amount)
                    fonts.load(`76px "Pirata One"`),
                    fonts.load(`140px "Pirata One"`),

                    // Bangers (labels)
                    fonts.load(`54px "Bangers"`),
                    fonts.load(`68px "Bangers"`),
                ]);
                await fonts.ready;

                this.fontReady = true;
                this.applyFontsToTexts();
            } catch {
                // ignore
            }
        })();

        return this.fontLoadPromise;
    }

    private applyFontsToTexts() {
        if (this.amountText) (this.amountText.style as any).fontFamily = "Pirata One";
        if (this.spinsText) (this.spinsText.style as any).fontFamily = "Pirata One";

        if (this.freeSpinsText) (this.freeSpinsText.style as any).fontFamily = "Bangers";
        if (this.scattersNumberText) (this.scattersNumberText.style as any).fontFamily = "Bangers";
        if (this.scattersWordText) (this.scattersWordText.style as any).fontFamily = "Bangers";

        // keep number white after font change too
        if (this.scattersNumberText) (this.scattersNumberText.style as any).fill = 0xffffff;

        // force rebuild (same trick you used)
        const texts = [this.amountText, this.spinsText, this.freeSpinsText, this.scattersNumberText, this.scattersWordText];
        for (const t of texts) {
            if (!t) continue;
            t.text = `${t.text} `;
            t.text = t.text.trimEnd();
        }

        this.relayout();
    }
}
