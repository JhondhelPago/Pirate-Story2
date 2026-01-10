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

export type FreeSpinWinBannerData = {
    spins: number;
    topText?: string;
    bottomText?: string;

    // optional auto close
    autoClose?: boolean; // default false
    duration?: number;   // ms. Used only when autoClose=true and duration>0

    onClosed?: () => void;
};

export class FreeSpinWinBanner extends Container {
    public static currentInstance: FreeSpinWinBanner | null = null;

    private static readonly BANNER_BOARD_TEX = "freeSpinWinBoard";

    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;
    private topText!: Text;
    private bottomText!: Text;
    private spinsText!: Text;
    private continueText!: Text;

    // glow system (behind the board)
    private glowA?: Sprite;
    private glowB?: Sprite;
    private glowBaseScale = 1;

    private glowEntranceTween?: gsap.core.Tween;
    private glowOpacityTween?: gsap.core.Tween;

    private currentDisplayValue = 0;
    private spins = 0;

    private canClickAnywhere = false;
    private onClosed?: () => void;

    // prevent double-callback
    private closedOnce = false;

    // auto-close settings
    private autoClose = false;
    private autoCloseDuration = 0;
    private autoCloseTimer?: number;

    private readonly TOP_TEXT_Y = -160;
    private readonly CENTER_NUMBER_Y = -5;
    private readonly BOTTOM_TEXT_Y = 155;

    // keyboard handling
    private keyListenerAdded = false;
    private readonly keyDownHandler = (e: KeyboardEvent) => {
        if (!this.canClickAnywhere) return;
        if (e.code !== "Space" && e.code !== "Enter") return;
        this.requestClose();
    };

    private isClosing = false;

    // ✅ audio instance(s) owned by this banner
    private sfxFreeSpinWin: any = null;

    // ✅ reduce/restore bgm like SpinRoundBanner
    private bgmDuckTween?: gsap.core.Tween;
    private bgmRestoreTween?: gsap.core.Tween;

    // ✅ visibility/blur safety (same idea as SpinRoundBanner)
    private onVisibilityChangeBound = () => {
        if (document.hidden) {
            this.forceStopAllBannerAudio();
            this.killNumberTweenOnly();
        }
    };

    private onWindowBlurBound = () => {
        this.forceStopAllBannerAudio();
        this.killNumberTweenOnly();
    };

    // number tween reference so it can’t orphan
    private numberTween?: gsap.core.Tween;

    // ==================================================
    // static close helper
    // ==================================================
    public static triggerClose(forceInstant = false) {
        if (FreeSpinWinBanner.currentInstance) {
            void FreeSpinWinBanner.currentInstance.hide(forceInstant);
        }
    }

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

        // close on click anywhere
        this.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            this.requestClose();
        });

        this.panel = new Container();
        this.addChild(this.panel);
    }

    private async requestClose() {
        if (!this.canClickAnywhere) return;
        if (this.isClosing) return;
        this.isClosing = true;
        this.canClickAnywhere = false;

        await this.hide();
    }

    // ==================================================
    // auto-close helpers
    // ==================================================
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
            // avoid closing before "press anywhere" is enabled
            if (!this.canClickAnywhere) {
                this.autoCloseTimer = window.setTimeout(() => {
                    if (this.canClickAnywhere) void this.hide();
                }, 100);
                return;
            }
            void this.hide();
        }, this.autoCloseDuration);
    }

    // ==================================================
    // CLOSED callback (IMPORTANT ORDERING)
    // ==================================================
    private fireClosedOnce() {
        if (this.closedOnce) return;
        this.closedOnce = true;

        const cb = this.onClosed;
        this.onClosed = undefined;

        try {
            cb?.();
        } catch (e) {
            console.warn("[FreeSpinWinBanner] onClosed error:", e);
        }
    }

    // ==================================================
    // PREPARE
    // ==================================================
    public async prepare<T>(data?: T) {
        const d = data as any as FreeSpinWinBannerData;

        // ✅ safety: cleanup if reused
        this.clearAutoCloseTimer();
        this.killNumberTweenOnly();
        this.forceStopAllBannerAudio();
        this.killBgmTweensOnly();

        this.spins = Math.max(0, Math.floor(d?.spins ?? 0));

        // ✅ wrap onClosed so we restore music no matter what (like SpinRoundBanner)
        const userOnClosed = d?.onClosed;
        this.onClosed = () => {
            this.forceStopAllBannerAudio();
            this.restoreBgmVolume();
            userOnClosed?.();
        };

        // reset close guards
        this.closedOnce = false;
        this.isClosing = false;
        this.canClickAnywhere = false;

        // auto-close config with defaults
        this.autoClose = typeof d?.autoClose === "boolean" ? d.autoClose : false;
        this.autoCloseDuration = typeof d?.duration === "number" ? d.duration : 0;

        const topLabel = d?.topText ?? "YOU HAVE WON";
        const bottomLabel = d?.bottomText ?? "FREE SPINS";

        await this.waitForFonts(["Bangers", "Pirata One"]);

        // ✅ duck BGM while banner SFX is playing (same logic as SpinRoundBanner)
        this.duckBgmVolume();

        // attach window/tab listeners while banner alive
        document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.addEventListener("blur", this.onWindowBlurBound);

        this.createBanner();
        this.createGlow();
        this.createWoodTexts(topLabel, bottomLabel);
        this.createCenterNumber();
        this.createContinueText();

        this.animateEntrance();
        this.animateWoodPulse();

        setTimeout(() => this.animateNumber(), 350);

        // attach keyboard listener once
        if (!this.keyListenerAdded && typeof window !== "undefined") {
            window.addEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = true;
        }

        // enable "press anywhere"
        setTimeout(() => {
            this.canClickAnywhere = true;
            this.scheduleAutoCloseIfNeeded();
        }, 900);
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
    // BGM DUCK / RESTORE (mirrors SpinRoundBanner)
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
    // GLOW HELPERS
    // ==================================================
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

    private getGlows(): Sprite[] {
        const arr: Sprite[] = [];
        if (this.glowA) arr.push(this.glowA);
        if (this.glowB) arr.push(this.glowB);
        return arr;
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

        // behind the board & texts
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
    // UI BUILD
    // ==================================================
    private createBanner() {
        if (this.banner) {
            this.banner.removeFromParent();
            this.banner.destroy();
        }
        this.banner = Sprite.from(FreeSpinWinBanner.BANNER_BOARD_TEX);
        this.banner.anchor.set(0.5);
        this.banner.x = 0;
        this.banner.y = 0;

        this.panel.addChild(this.banner);
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

    private createContinueText() {
        this.continueText?.destroy();

        this.continueText = new Text("PRESS ANYWHERE TO CONTINUE", {
            ...this.createWoodLabelStyle(36),
            fontFamily: "Bangers",
            letterSpacing: 2,
        });

        this.continueText.anchor.set(0.5);
        this.continueText.y = this.BOTTOM_TEXT_Y + 110;
        this.continueText.alpha = 1;

        this.panel.addChild(this.continueText);
    }

    // ==================================================
    // TEXT STYLES
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
        // ✅ play sfx and keep instance so we can stop it
        this.forceStopAllBannerAudio();
        try {
            this.sfxFreeSpinWin = sfx.play("common/sfx-freespin-win.wav");
        } catch {}

        const startOffset = -900;

        // kill any previous tweens
        gsap.killTweensOf(
            [
                this.banner,
                this.topText,
                this.spinsText,
                this.bottomText,
                this.continueText,
                ...this.getGlows(),
                this.bg,
            ].filter(Boolean),
        );
        gsap.killTweensOf(
            [this.topText?.scale, this.bottomText?.scale, this.continueText?.scale].filter(Boolean),
        );
        this.killNumberTweenOnly();

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

        // prepare glow state
        this.syncGlowToBanner();
        for (const g of this.getGlows()) {
            g.alpha = 0;
            g.rotation = 0;
            g.scale.set(g === this.glowB ? this.glowBaseScale * 0.97 : this.glowBaseScale);
        }

        const items = [
            ...this.getGlows(),
            this.banner,
            this.topText,
            this.spinsText,
            this.bottomText,
            this.continueText,
        ].filter(Boolean) as any[];

        // set initial state
        items.forEach((i) => {
            i.alpha = 0;
            i.y += startOffset;
        });

        // animate in
        items.forEach((i, idx) => {
            gsap.to(i, {
                alpha: 1,
                y: i.y - startOffset,
                duration: 0.7,
                delay: idx * 0.05,
                ease: "bounce.out",
                onUpdate: () => {
                    if (i === this.banner || i === this.topText || i === this.spinsText) {
                        this.syncGlowToBanner();
                    }
                },
                onComplete: () => {
                    this.syncGlowToBanner();
                    if (i === this.banner) {
                        this.showGlowEffects();
                    }
                },
            });
        });
    }

    private animateWoodPulse() {
        gsap.killTweensOf([this.topText.scale, this.bottomText.scale, this.continueText.scale]);

        gsap.to([this.topText.scale, this.bottomText.scale, this.continueText.scale], {
            x: 1.06,
            y: 1.06,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        });
    }

    private animateNumber() {
        this.killNumberTweenOnly();

        this.currentDisplayValue = 0;

        this.numberTween = gsap.to(this, {
            currentDisplayValue: this.spins,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
                this.spinsText.text = String(Math.floor(this.currentDisplayValue));
            },
            onComplete: () => {
                this.numberTween = undefined;

                gsap.fromTo(
                    this.spinsText.scale,
                    { x: 0.85, y: 0.85 },
                    { x: 1, y: 1, duration: 0.6, ease: "elastic.out(1, 0.6)" },
                );
            },
        });
    }

    private killNumberTweenOnly() {
        if (this.numberTween) {
            try { this.numberTween.kill(); } catch {}
            this.numberTween = undefined;
        }
        // the number tween targets "this"
        gsap.killTweensOf(this);
    }

    private forceStopAllBannerAudio() {
        try {
            this.sfxFreeSpinWin?.stop?.();
        } catch {}
        this.sfxFreeSpinWin = null;
    }

    // ==================================================
    // RESIZE & HIDE
    // ==================================================
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.banner?.scale.set(1.3);

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
    }

    public async hide(forceInstant = false) {
        this.canClickAnywhere = false;

        // detach handlers
        document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.removeEventListener("blur", this.onWindowBlurBound);

        // clear auto-close
        this.clearAutoCloseTimer();

        // remove keyboard listener
        if (this.keyListenerAdded && typeof window !== "undefined") {
            window.removeEventListener("keydown", this.keyDownHandler);
            this.keyListenerAdded = false;
        }

        // stop banner audio + kill number tween
        this.forceStopAllBannerAudio();
        this.killNumberTweenOnly();

        // kill wood pulse tweens
        gsap.killTweensOf([this.topText?.scale, this.bottomText?.scale, this.continueText?.scale].filter(Boolean));

        // kill glow tweens
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
            ...this.getGlows(),
            this.banner,
            this.topText,
            this.spinsText,
            this.bottomText,
            this.continueText,
            this.bg,
        ].filter(Boolean);

        if (forceInstant) {
            this.alpha = 0;
            FreeSpinWinBanner.currentInstance = null;

            // ✅ IMPORTANT: dismiss first, then onClosed (prevents “next popup got dismissed”)
            try { await navigation.dismissPopup(); } catch {}
            this.restoreBgmVolume();
            this.fireClosedOnce();
            return;
        }

        await gsap.to(items as any, { alpha: 0, duration: 0.25 });

        FreeSpinWinBanner.currentInstance = null;

        // ✅ IMPORTANT: dismiss first, then onClosed (same reasoning)
        try { await navigation.dismissPopup(); } catch {}
        this.restoreBgmVolume();
        this.fireClosedOnce();
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
        this.killNumberTweenOnly();
        this.killBgmTweensOnly();

        gsap.killTweensOf(this.topText?.scale);
        gsap.killTweensOf(this.bottomText?.scale);
        gsap.killTweensOf(this.continueText?.scale);

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

        // make sure bgm is restored if destroyed unexpectedly
        this.restoreBgmVolume();

        this.fireClosedOnce();

        super.destroy(options);

        if (FreeSpinWinBanner.currentInstance === this) {
            FreeSpinWinBanner.currentInstance = null;
        }
    }
}
