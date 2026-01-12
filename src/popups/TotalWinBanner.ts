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
import { bgm, sfx } from "../utils/audio";

export class TotalWinBanner extends Container {
    public static currentInstance: TotalWinBanner | null = null;

    private static readonly BANNER_BOARD_TEX = "freeSpinTotalWinBoard";

    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;

    private glowA?: Sprite;
    private glowB?: Sprite;
    private glowBaseScale = 1;

    private glowEntranceTween?: gsap.core.Tween;
    private glowOpacityTween?: gsap.core.Tween;

    // Header group (both lines animate together)
    private headerGroup!: Container;
    private headerLine1!: Text;
    private headerLine2!: Text;

    // "PRESS ANYWHERE TO CONTINUE"
    private continueText!: Text;

    // Amount (counting)
    private amountText!: Text;
    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    // spins line under amount
    private spinsText!: Text;
    private freeSpins = 0;

    private canClickAnywhere = false;

    private readonly HEADER_OFFSET_Y = -180;
    private readonly AMOUNT_OFFSET_Y = 40;
    private readonly HEADER_LINE_GAP = 10;

    private readonly SPINS_OFFSET_Y = 150;
    private readonly CONTINUE_OFFSET_Y = 220;

    // onClosed from navigation.presentPopup(...)
    private onClosed?: () => void | Promise<void>;
    private closedOnce = false;

    // Keyboard handling
    private keyListenerAdded = false;
    private readonly keyDownHandler = (e: KeyboardEvent) => {
        if (!this.canClickAnywhere) return;
        void this.hide();
    };

    // Auto-close
    private autoClose = false; // default false
    private autoCloseDuration = 0; // default 0 (ms)
    private autoCloseTimer?: number;

    // ✅ audio instances owned by this banner
    private sfxTotalWin: any = null; // main banner sfx instance
    private sfxWinRise: any = null;

    // ✅ keep amount tween ref so it can be killed safely
    private amountTween?: gsap.core.Tween;

    // ✅ BGM duck/restore (same logic as SpinRoundBanner)
    private bgmDuckTween?: gsap.core.Tween;
    private bgmRestoreTween?: gsap.core.Tween;

    // ✅ visibility/blur safety (same pattern)
    private onVisibilityChangeBound = () => {
        if (document.hidden) {
            this.forceStopAllBannerAudio();
            this.killAmountTweenOnly();
        }
    };

    private onWindowBlurBound = () => {
        this.forceStopAllBannerAudio();
        this.killAmountTweenOnly();
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

        // Close when clicking anywhere
        this.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            void this.hide();
        });

        this.panel = new Container();
        this.addChild(this.panel);

        this.headerGroup = new Container();
        this.panel.addChild(this.headerGroup);
    }

    public static forceDismiss() {
        if (TotalWinBanner.currentInstance) {
            void TotalWinBanner.currentInstance.hide(true);
            TotalWinBanner.currentInstance = null;
        }
    }

    public static triggerClose(forceInstant = false) {
        if (TotalWinBanner.currentInstance) {
            void TotalWinBanner.currentInstance.hide(forceInstant);
        }
    }

    public requestClose(forceInstant = false) {
        void this.hide(forceInstant);
    }

    private clearAutoCloseTimer() {
        if (this.autoCloseTimer != null) {
            clearTimeout(this.autoCloseTimer);
            this.autoCloseTimer = undefined;
        }
    }

    private scheduleAutoCloseIfNeeded() {
        this.clearAutoCloseTimer();

        if (!this.autoClose) return;
        if (!Number.isFinite(this.autoCloseDuration) || this.autoCloseDuration <= 0) return;

        this.autoCloseTimer = window.setTimeout(() => {
            if (!this.canClickAnywhere) {
                this.autoCloseTimer = window.setTimeout(() => {
                    if (this.canClickAnywhere) void this.hide();
                }, 100);
                return;
            }
            void this.hide();
        }, this.autoCloseDuration);
    }

    public async prepare<T>(data?: T) {
        const anyData = data as any;

        // ✅ safety cleanup if reused
        this.clearAutoCloseTimer();
        this.killAmountTweenOnly();
        this.forceStopAllBannerAudio();
        this.killBgmTweensOnly();

        // capture close callback
        const userOnClosed = typeof anyData?.onClosed === "function" ? anyData.onClosed : undefined;

        // wrap onClosed to always restore bgm like SpinRoundBanner
        this.onClosed = async () => {
            this.forceStopAllBannerAudio();
            this.restoreBgmVolume();
            try {
                await userOnClosed?.();
            } catch (e) {
                console.warn("[TotalWinBanner] onClosed error:", e);
            }
        };
        this.closedOnce = false;

        const win = typeof anyData?.win === "number" ? anyData.win : 0;
        const spins = typeof anyData?.spins === "number" ? anyData.spins : 0;
        this.freeSpins = spins;
        this.targetDisplayValue = win;

        // auto-close options
        this.autoClose = typeof anyData?.autoClose === "boolean" ? anyData.autoClose : false;
        this.autoCloseDuration = typeof anyData?.duration === "number" ? anyData.duration : 0;

        // reset interaction gate
        this.canClickAnywhere = false;

        // Ensure fonts are loaded before measuring Text heights
        await this.waitForFonts(["Bangers", "Pirata One"]);

        // ✅ duck BGM while banner audio plays
        this.duckBgmVolume();

        // ✅ attach window/tab listeners while banner alive
        document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.addEventListener("blur", this.onWindowBlurBound);

        this.createBanner();
        this.createGlow();
        this.createHeaderText();
        this.createAmountText();
        this.createSpinsText();
        this.createContinueText();

        this.animateEntrance();
        this.animateHeaderPulse();

        setTimeout(() => this.animateAmount(), 500);

        // attach keyboard listener once
        if (!this.keyListenerAdded && typeof window !== "undefined") {
            window.addEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = true;
        }

        // allow dismiss after animations settle
        setTimeout(() => {
            this.canClickAnywhere = true;
            this.scheduleAutoCloseIfNeeded();
        }, 1200);
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
    // BGM DUCK / RESTORE
    // ==================================================
    private killBgmTweensOnly() {
        if (this.bgmDuckTween) {
            try { this.bgmDuckTween.kill(); } catch {}
            this.bgmDuckTween = undefined;
        }
        if (this.bgmRestoreTween) {
            try { this.bgmRestoreTween.kill(); } catch {}
            this.bgmRestoreTween = undefined;
        }
    }

    private duckBgmVolume() {
        const music = bgm.current;
        if (!music) return;

        this.killBgmTweensOnly();
        gsap.killTweensOf(music);

        this.bgmDuckTween = gsap.to(music, {
            volume: bgm.getVolume() * 0.3,
            duration: 0.2,
            ease: "linear",
            onComplete: () => {
                this.bgmDuckTween = undefined;
            },
        });
    }

    private restoreBgmVolume() {
        const music = bgm.current;
        if (!music) return;

        this.killBgmTweensOnly();
        gsap.killTweensOf(music);

        this.bgmRestoreTween = gsap.to(music, {
            volume: bgm.getVolume(),
            duration: 0.1,
            ease: "linear",
            onComplete: () => {
                this.bgmRestoreTween = undefined;
            },
        });
    }

    // ==================================================
    // GLOW
    // ==================================================
    private getGlows(): Sprite[] {
        const arr: Sprite[] = [];
        if (this.glowA) arr.push(this.glowA);
        if (this.glowB) arr.push(this.glowB);
        return arr;
    }

    private syncGlowToBanner() {
        if (!this.banner) return;
        const bx = this.banner.x;
        const by = this.banner.y;

        if (this.glowA) {
            this.glowA.x = bx;
            this.glowA.y = by;
        }
        if (this.glowB) {
            this.glowB.x = bx;
            this.glowB.y = by;
        }
    }

    private createGlow() {
        for (const g of this.getGlows()) {
            g.removeFromParent();
            g.destroy();
        }
        this.glowA = undefined;
        this.glowB = undefined;

        const glowTexture = Texture.from("glow");

        const makeGlow = () => {
            const s = new Sprite(glowTexture);
            s.anchor.set(0.5);
            return s;
        };

        this.glowA = makeGlow();
        this.glowB = makeGlow();

        this.panel.addChildAt(this.glowA, 0);
        this.panel.addChildAt(this.glowB, 1);

        this.syncGlowToBanner();

        const bannerWidth = this.banner.width;
        const bannerHeight = this.banner.height;

        const targetWidth = bannerWidth * 1.7;
        const targetHeight = bannerHeight * 1.7;

        const scaleX = targetWidth / glowTexture.width;
        const scaleY = targetHeight / glowTexture.height;
        const finalScale = Math.max(scaleX, scaleY);

        this.glowBaseScale = finalScale;

        this.glowA.scale.set(finalScale);
        this.glowB.scale.set(finalScale * 0.97);

        this.glowA.alpha = 0;
        this.glowB.alpha = 0;

        this.glowA.rotation = 0;
        this.glowB.rotation = 0;
    }

    private showGlowEffects() {
        const gA = this.glowA;
        const gB = this.glowB;
        if (!gA || !gB) return;

        this.syncGlowToBanner();

        gsap.killTweensOf([gA, gB, gA.scale, gB.scale]);
        if (this.glowEntranceTween) {
            this.glowEntranceTween.kill();
            this.glowEntranceTween = undefined;
        }
        if (this.glowOpacityTween) {
            this.glowOpacityTween.kill();
            this.glowOpacityTween = undefined;
        }

        gA.alpha = 0;
        gB.alpha = 0;

        this.glowEntranceTween = gsap.to([gA, gB], {
            alpha: 0.85,
            duration: 0.25,
            ease: "power2.out",
            onComplete: () => {
                this.glowEntranceTween = undefined;
                this.animateGlowIdle();
            },
        });
    }

    private animateGlowIdle() {
        const gA = this.glowA;
        const gB = this.glowB;
        if (!gA || !gB) return;

        this.syncGlowToBanner();

        gsap.killTweensOf([gA, gB, gA.scale, gB.scale]);

        gA.scale.set(this.glowBaseScale);
        gB.scale.set(this.glowBaseScale * 0.97);

        const makePlayfulSpin = (target: Sprite, direction: 1 | -1, totalDuration: number) => {
            gsap.killTweensOf(target);

            const step = (Math.PI * 2) / 3;
            const d1 = totalDuration * 0.34;
            const d2 = totalDuration * 0.33;
            const d3 = totalDuration * 0.33;

            const tl = gsap.timeline({ repeat: -1 });
            tl.to(target, { rotation: `+=${direction * step}`, duration: d1, ease: "sine.inOut" });
            tl.to(target, { rotation: `+=${direction * step}`, duration: d2, ease: "sine.inOut" });
            tl.to(target, { rotation: `+=${direction * step}`, duration: d3, ease: "sine.inOut" });
            return tl;
        };

        makePlayfulSpin(gA, 1, 18);
        makePlayfulSpin(gB, -1, 26);

        const A_MAX = 0.95;
        const A_MIN = 0.4;
        const B_MAX = 0.85;
        const B_MIN = 0.3;

        gA.alpha = A_MAX;
        gB.alpha = B_MIN;

        this.glowOpacityTween = gsap.to(
            { t: 0 },
            {
                t: 1,
                duration: 1.8,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                onUpdate: function () {
                    const t = (this.targets()[0] as any).t as number;
                    gA.alpha = A_MAX + (A_MIN - A_MAX) * t;
                    gB.alpha = B_MIN + (B_MAX - B_MIN) * t;
                },
            },
        );

        gsap.to(gA.scale, {
            x: this.glowBaseScale * 1.04,
            y: this.glowBaseScale * 1.04,
            duration: 2.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });

        gsap.to(gB.scale, {
            x: this.glowBaseScale * 1.01,
            y: this.glowBaseScale * 1.01,
            duration: 2.6,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });
    }

    // ==================================================
    // BANNER
    // ==================================================
    private createBanner() {
        if (this.banner) {
            this.banner.removeFromParent();
            this.banner.destroy();
        }

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

        this.headerLine1 = new Text("CONGRATULATIONS!", {
            ...this.createHeaderGradientStyle(110),
            fontFamily: "Bangers",
            letterSpacing: 6,
        });
        this.headerLine1.anchor.set(0.5);

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
        if (this.amountText) {
            this.amountText.removeFromParent();
            this.amountText.destroy();
        }

        this.amountText = new Text("$0.00", this.createAmountGradientStyle(150));
        this.amountText.anchor.set(0.5);
        this.amountText.x = 0;
        this.amountText.y = this.AMOUNT_OFFSET_Y;

        this.panel.addChild(this.amountText);
    }

    // ==================================================
    // "IN X FREE SPINS"
    // ==================================================
    private createSpinsText() {
        if (this.spinsText) {
            this.spinsText.removeFromParent();
            this.spinsText.destroy();
        }

        const text = this.freeSpins > 0 ? `IN ${this.freeSpins} FREE SPINS` : "";

        this.spinsText = new Text(text, {
            ...this.createSubHeaderGradientStyle(64),
            fontFamily: "Bangers",
            letterSpacing: 4,
        });
        this.spinsText.anchor.set(0.5);
        this.spinsText.x = 0;
        this.spinsText.y = this.AMOUNT_OFFSET_Y + this.SPINS_OFFSET_Y;

        this.panel.addChild(this.spinsText);
    }

    // ==================================================
    // "PRESS ANYWHERE TO CONTINUE"
    // ==================================================
    private createContinueText() {
        if (this.continueText) {
            this.continueText.removeFromParent();
            this.continueText.destroy();
        }

        this.continueText = new Text("PRESS ANYWHERE TO CONTINUE", {
            ...this.createSubHeaderGradientStyle(48),
            fontFamily: "Bangers",
            letterSpacing: 4,
        });
        this.continueText.anchor.set(0.5);
        this.continueText.x = 0;
        this.continueText.y = this.AMOUNT_OFFSET_Y + this.CONTINUE_OFFSET_Y;

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
            fontFamily: "Bangers",
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
        if (this.spinsText) gsap.killTweensOf(this.spinsText.scale);

        this.headerGroup.scale.set(1);
        if (this.continueText) this.continueText.scale.set(1);
        if (this.spinsText) this.spinsText.scale.set(1);

        gsap.to(this.headerGroup.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });

        if (this.spinsText) {
            gsap.to(this.spinsText.scale, {
                x: 1.08,
                y: 1.08,
                duration: 1.2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });
        }

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
        // ✅ ensure no previous tween keeps running
        this.killAmountTweenOnly();

        this.currentDisplayValue = 0;

        console.log("expected total win from this.targetDisplayValue: ", this.targetDisplayValue);

        // ✅ play banner sfx and keep instance
        this.forceStopAllBannerAudio();
        try {
            this.sfxTotalWin = sfx.play("common/sfx-total-win.wav");
            // this.sfxWinRise = sfx.playSegment("common/sfx-win-rise.wav", 0, 2);
            this.sfxWinRise = this.targetDisplayValue > 0 ? sfx.playSegment("common/sfx-win-rise.wav", 0, 2, {volume: 0.5}) : null;
        } catch {}

        // ✅ store tween reference, so it can be killed on blur/hidden/hide()
        this.amountTween = gsap.to(this, {
            currentDisplayValue: this.targetDisplayValue,
            duration: 2,
            ease: "power2.out",
            onUpdate: () => {
                this.amountText.text = this.formatCurrency(this.currentDisplayValue);
            },
            onComplete: () => {
                this.amountTween = undefined;

                gsap.fromTo(
                    this.amountText.scale,
                    { x: 0.85, y: 0.85 },
                    {
                        x: 1,
                        y: 1,
                        duration: 1,
                        ease: "elastic.out(1, 0.6)",
                        onComplete: () => this.animateAmountPulse(),
                    },
                );
            },
        });
    }

    private killAmountTweenOnly() {
        if (this.amountTween) {
            try {
                this.amountTween.kill();
            } catch {}
            this.amountTween = undefined;
        }
        // safety: kill any gsap tween targeting this object (amount tween is gsap.to(this, ...))
        gsap.killTweensOf(this);
    }

    private forceStopAllBannerAudio() {
        try {
            this.sfxTotalWin?.stop?.();
            this.sfxWinRise?.stop?.();
        } catch {}
        this.sfxTotalWin = null;
        this.sfxWinRise = null;
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
        // ✅ stop owned audio/tweens before starting entrance
        this.forceStopAllBannerAudio();
        this.killAmountTweenOnly();

        gsap.killTweensOf([
            this.banner,
            this.headerGroup,
            this.amountText,
            this.spinsText,
            this.continueText,
            ...this.getGlows(),
        ]);

        if (this.glowEntranceTween) {
            this.glowEntranceTween.kill();
            this.glowEntranceTween = undefined;
        }
        if (this.glowOpacityTween) {
            this.glowOpacityTween.kill();
            this.glowOpacityTween = undefined;
        }
        for (const g of this.getGlows()) {
            gsap.killTweensOf(g);
            gsap.killTweensOf(g.scale);
        }

        const startOffset = -900;

        const bannerY = this.banner.y;
        const headerY = this.headerGroup.y;
        const amountY = this.amountText.y;
        const spinsY = this.spinsText?.y ?? 0;
        const continueY = this.continueText.y;

        this.syncGlowToBanner();

        for (const g of this.getGlows()) {
            g.alpha = 0;
            g.rotation = 0;
            g.scale.set(g === this.glowB ? this.glowBaseScale * 0.97 : this.glowBaseScale);
        }

        this.banner.alpha = 0;
        this.headerGroup.alpha = 0;
        this.amountText.alpha = 0;
        if (this.spinsText) this.spinsText.alpha = 0;
        this.continueText.alpha = 0;

        this.banner.y = bannerY + startOffset;
        this.headerGroup.y = headerY + startOffset;
        this.amountText.y = amountY + startOffset;
        if (this.spinsText) this.spinsText.y = spinsY + startOffset;
        this.continueText.y = continueY + startOffset;

        gsap.to(this.banner, {
            alpha: 1,
            y: bannerY,
            duration: 0.7,
            ease: "bounce.out",
            onUpdate: () => {
                this.syncGlowToBanner();
            },
            onComplete: () => {
                this.syncGlowToBanner();
                this.showGlowEffects();
            },
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

        if (this.spinsText) {
            gsap.to(this.spinsText, {
                alpha: 1,
                y: spinsY,
                duration: 0.7,
                delay: 0.125,
                ease: "bounce.out",
            });
        }

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

        const gA = this.glowA;
        const gB = this.glowB;
        if (gA && gB && this.banner) {
            const bannerWidth = this.banner.width;
            const bannerHeight = this.banner.height;

            const targetWidth = bannerWidth * 1.7;
            const targetHeight = bannerHeight * 1.7;

            const scaleX = targetWidth / gA.texture.width;
            const scaleY = targetHeight / gA.texture.height;
            const finalScale = Math.max(scaleX, scaleY);

            this.glowBaseScale = finalScale;

            gA.scale.set(finalScale);
            gB.scale.set(finalScale * 0.97);

            this.syncGlowToBanner();
        }

        this.layoutHeaderLines();
    }

    private async fireClosedOnce() {
        if (this.closedOnce) return;
        this.closedOnce = true;

        const cb = this.onClosed;
        this.onClosed = undefined;

        try {
            await cb?.();
        } catch (e) {
            console.warn("[TotalWinBanner] onClosed error:", e);
        }
    }

    public async hide(forceInstant = false) {
        this.canClickAnywhere = false;

        // ✅ detach handlers
        document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.removeEventListener("blur", this.onWindowBlurBound);

        // always clear auto-close timer on hide
        this.clearAutoCloseTimer();

        if (this.keyListenerAdded && typeof window !== "undefined") {
            window.removeEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = false;
        }

        // stop audio + kill amount tween so onComplete can’t fire later
        this.forceStopAllBannerAudio();
        this.killAmountTweenOnly();

        gsap.killTweensOf(this.headerGroup.scale);
        gsap.killTweensOf(this.amountText.scale);
        if (this.continueText) gsap.killTweensOf(this.continueText.scale);
        if (this.spinsText) gsap.killTweensOf(this.spinsText.scale);

        if (this.glowEntranceTween) {
            this.glowEntranceTween.kill();
            this.glowEntranceTween = undefined;
        }
        if (this.glowOpacityTween) {
            this.glowOpacityTween.kill();
            this.glowOpacityTween = undefined;
        }
        for (const g of this.getGlows()) {
            gsap.killTweensOf(g);
            gsap.killTweensOf(g.scale);
        }

        const items = [
            this.banner,
            ...this.getGlows(),
            this.headerGroup,
            this.amountText,
            this.spinsText,
            this.continueText,
            this.bg,
        ].filter(Boolean) as any[];

        if (forceInstant) {
            this.alpha = 0;
            TotalWinBanner.currentInstance = null;

            // ✅ IMPORTANT ORDER: dismiss popup first, then onClosed (prevents dismissing next popup)
            try { await navigation.dismissPopup(); } catch {}
            this.restoreBgmVolume();
            await this.fireClosedOnce();
            return;
        }

        await gsap.to(items, {
            alpha: 0,
            duration: 0.25,
        });

        TotalWinBanner.currentInstance = null;

        // ✅ IMPORTANT ORDER: dismiss popup first, then onClosed
        try { await navigation.dismissPopup(); } catch {}
        this.restoreBgmVolume();
        await this.fireClosedOnce();
    }

    public override destroy(options?: any) {
        this.clearAutoCloseTimer();

        document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.removeEventListener("blur", this.onWindowBlurBound);

        if (this.keyListenerAdded && typeof window !== "undefined") {
            window.removeEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = false;
        }

        this.forceStopAllBannerAudio();
        this.killAmountTweenOnly();
        this.killBgmTweensOnly();
        this.restoreBgmVolume();

        gsap.killTweensOf(this.headerGroup?.scale);
        gsap.killTweensOf(this.amountText?.scale);
        if (this.continueText) gsap.killTweensOf(this.continueText.scale);
        if (this.spinsText) gsap.killTweensOf(this.spinsText.scale);

        if (this.glowEntranceTween) this.glowEntranceTween.kill();
        if (this.glowOpacityTween) this.glowOpacityTween.kill();
        for (const g of this.getGlows()) {
            gsap.killTweensOf(g);
            gsap.killTweensOf(g.scale);
        }

        void this.fireClosedOnce();

        super.destroy(options);

        if (TotalWinBanner.currentInstance === this) {
            TotalWinBanner.currentInstance = null;
        }
    }
}
