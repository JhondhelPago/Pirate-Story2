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
    labelFontSize?: number;      // "FREE SPINS"
    scattersFontSize?: number;   // "3 SCATTERS"
};

export class BuyFreeSpinOptionBanner extends Container {
    public sprite: Sprite;

    private amountText: Text;
    private spinsText: Text;

    // ✅ updated: single-line label built from 3 texts
    private labelLine: Container;
    private freeSpinsWordText: Text;
    private scattersNumberText: Text;
    private scattersWordText: Text;

    private typeLetter: BuyFreeTypeLetter;
    private amount: number;
    private currencySymbol: string;
    private decimals: number;

    private fontReady = false;
    private pirataLoadPromise: Promise<void> | null = null;

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

        // ✅ single-line: "FREE SPINS 3 SCATTERS" (Bangers), number is plain white
        const labelSize = cfg.labelFontSize ?? 54;

        this.labelLine = new Container();
        this.labelLine.eventMode = "none";

        this.freeSpinsWordText = this.createStyledText(`FREE SPINS `, labelSize, "Bangers");
        this.scattersNumberText = this.createStyledText(`${def.scatters}`, labelSize, "Bangers");
        this.scattersWordText = this.createStyledText(` SCATTERS`, labelSize, "Bangers");

        // ✅ number only = plain white (no gradient), keep stroke
        (this.scattersNumberText.style as any).fill = 0xffffff;

        this.labelLine.addChild(this.freeSpinsWordText, this.scattersNumberText, this.scattersWordText);

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
            gsap.to(this.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.1,
                yoyo: true,
                repeat: 1,
            });

            this.onTap?.();
        });

        this.ensurePirataOneLoaded();
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
        this.ensurePirataOneLoaded();
    }

    /** external: adjust center spins font size */
    public setSpinsFontSize(fontSize: number) {
        (this.spinsText.style as any).fontSize = fontSize;
        this.attachCenterTextsToBanner(this.sprite);
        this.ensurePirataOneLoaded();
    }

    /** optional: adjust label size */
    public setCenterLabelFontSizes(labelFontSize: number) {
        (this.freeSpinsWordText.style as any).fontSize = labelFontSize;
        (this.scattersNumberText.style as any).fontSize = labelFontSize;
        (this.scattersWordText.style as any).fontSize = labelFontSize;

        // keep number white even if style rebuilds
        (this.scattersNumberText.style as any).fill = 0xffffff;

        this.attachCenterTextsToBanner(this.sprite);
        this.ensurePirataOneLoaded();
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
        // keep your original bottom placement
        text.y = texH * 0.3 - bottomPadding;
    }

    /**
     * ✅ Places:
     *  - big spins number
     *  - single-line "FREE SPINS X SCATTERS"
     * inside a "safe" middle band so it won't overlap the wooden borders.
     */
    private attachCenterTextsToBanner(optionSprite: Sprite) {
        const texH =
            optionSprite.texture?.orig?.height ??
            optionSprite.texture?.height ??
            optionSprite.height;

        // ensure children are attached
        if (this.spinsText.parent !== optionSprite) optionSprite.addChild(this.spinsText);
        if (this.labelLine.parent !== optionSprite) optionSprite.addChild(this.labelLine);

        // --- SAFE AREA (middle band) ---
        const safeTop = -texH * 0.18;
        const safeBottom = texH * 0.18;
        const safeHeight = safeBottom - safeTop;

        // ✅ adjusted spacing a bit (more breathing room)
        const ySpins = safeTop + safeHeight * 0.08;
        const yLabel = safeTop + safeHeight * 0.75;

        this.spinsText.x = 0;
        this.spinsText.y = ySpins;

        // layout the single-line parts (centered as a whole)
        this.freeSpinsWordText.anchor.set(0, 0.5);
        this.scattersNumberText.anchor.set(0, 0.5);
        this.scattersWordText.anchor.set(0, 0.5);

        // measure widths and center the whole line
        const w1 = this.freeSpinsWordText.width;
        const w2 = this.scattersNumberText.width;
        const w3 = this.scattersWordText.width;
        const totalW = w1 + w2 + w3;

        const startX = -totalW / 2;

        this.freeSpinsWordText.x = startX;
        this.scattersNumberText.x = startX + w1;
        this.scattersWordText.x = startX + w1 + w2;

        this.freeSpinsWordText.y = 0;
        this.scattersNumberText.y = 0;
        this.scattersWordText.y = 0;

        this.labelLine.x = 0;
        this.labelLine.y = yLabel;

        // ✅ ensure number stays white (in case styles rebuild)
        (this.scattersNumberText.style as any).fill = 0xffffff;
    }

    // -----------------------
    // Font loading
    // -----------------------

    private ensurePirataOneLoaded() {
        if (this.pirataLoadPromise) return this.pirataLoadPromise;

        this.pirataLoadPromise = (async () => {
            try {
                const fonts: any = (document as any).fonts;
                if (!fonts?.load) {
                    this.fontReady = true;
                    this.applyFontsToTexts();
                    return;
                }

                await Promise.all([
                    // Pirata One (existing)
                    fonts.load(`48px "Pirata One"`),
                    fonts.load(`54px "Pirata One"`),
                    fonts.load(`68px "Pirata One"`),
                    fonts.load(`76px "Pirata One"`),
                    fonts.load(`120px "Pirata One"`),
                    fonts.load(`140px "Pirata One"`),

                    // ✅ Bangers (new for the label line)
                    fonts.load(`48px "Bangers"`),
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

        return this.pirataLoadPromise;
    }

    private applyFontsToTexts() {
        // Pirata One stays for amount + spins number
        if (this.amountText) (this.amountText.style as any).fontFamily = "Pirata One";
        if (this.spinsText) (this.spinsText.style as any).fontFamily = "Pirata One";

        // ✅ Bangers for: "FREE SPINS X SCATTERS"
        if (this.freeSpinsWordText) (this.freeSpinsWordText.style as any).fontFamily = "Bangers";
        if (this.scattersNumberText) (this.scattersNumberText.style as any).fontFamily = "Bangers";
        if (this.scattersWordText) (this.scattersWordText.style as any).fontFamily = "Bangers";

        // keep number white after font change too
        if (this.scattersNumberText) (this.scattersNumberText.style as any).fill = 0xffffff;

        // force rebuild (same trick you used)
        const texts = [this.amountText, this.spinsText, this.freeSpinsWordText, this.scattersNumberText, this.scattersWordText];
        for (const t of texts) {
            if (!t) continue;
            t.text = `${t.text} `;
            t.text = t.text.trimEnd();
        }

        this.relayout();
    }
}
