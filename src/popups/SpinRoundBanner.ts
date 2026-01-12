import { AnimatedSprite, Container, Sprite, Texture, Text, Matrix } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";
import { bgm, sfx } from "../utils/audio";

type BannerItem = {
    max: number;
    board: string;
    text: string;
    sfx: string;
};

export type SpinRoundBannerData = {
    win: number;
    onClosed?: () => void;
};

export class SpinRoundBanner extends Container {
    public static currentInstance: SpinRoundBanner | null = null;

    private bg: Sprite;
    private panel: Container;

    // 🪙 coin effects container (blast + fall) - FULL SCREEN coords
    private coinContainer: Container;

    // 🔥 two glow instances behind the board
    private glowA?: Sprite;
    private glowB?: Sprite;
    private glowBaseScale = 1;

    private banner!: Sprite;
    private headerText!: Sprite;

    private valueText!: Text;
    private currentDisplayValue = 0;
    private targetDisplayValue = 0;

    private winValue: number = 0;
    private canClickAnywhere = false;

    private onClosed?: () => void;

    private timeouts: Array<ReturnType<typeof setTimeout>> = [];

    private glowEntranceTween?: gsap.core.Tween;
    private glowOpacityTween?: gsap.core.Tween;

    // coin blast controller
    private coinBlastActive = false;

    // ✅ audio instances that MUST be stopped
    private sfxCoinBlast: any = null;
    private sfxCollectWin: any = null;

    // ✅ keep a reference to the amount tween so it can’t get orphaned
    private valueTween?: gsap.core.Tween;

    private readonly HEADER_OFFSET_Y = -180;
    private readonly HEADER_OFFSET_X = 20;

    // ✅ event handlers (bound once)
    private onVisibilityChangeBound = () => {
        // If user switches tab while counting, onComplete may never run.
        // So we force cleanup here.
        if (document.hidden) {
            this.forceStopAllBannerAudio();
            this.killValueTweenOnly();
        }
    };

    private onWindowBlurBound = () => {
        // Some platforms fire blur without visibilitychange.
        this.forceStopAllBannerAudio();
        this.killValueTweenOnly();
    };

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

        this.coinContainer = new Container();
        this.addChild(this.coinContainer);

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

        // ✅ safety: kill any leftovers if prepare is called again
        this.clearTimeouts();
        this.killValueTweenOnly();
        this.forceStopAllBannerAudio();

        this.winValue = anyData?.win ?? 0;
        this.targetDisplayValue = this.winValue;

        const music = bgm.current;
        if (music) {
            gsap.killTweensOf(music);
            gsap.to(music, {
                volume: bgm.getVolume() * 0.3,
                duration: 0.2,
                ease: "linear",
            });
        }

        const userOnClosed = anyData?.onClosed;

        this.onClosed = () => {
            // ✅ absolute safety net
            this.forceStopAllBannerAudio();

            const m = bgm.current;
            if (m) {
                gsap.killTweensOf(m);
                gsap.to(m, {
                    volume: bgm.getVolume(),
                    duration: 0.1,
                    ease: "linear",
                });
            }
            userOnClosed?.();
        };

        // ✅ attach window/tab listeners while the banner is alive
        document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.addEventListener("blur", this.onWindowBlurBound);

        this.createBanner();
        this.createGlow();
        this.createHeaderText();
        this.createValueText();

        this.animateEntrance();
        this.animateHeaderPulse();

        this.timeouts.push(setTimeout(() => this.animateValue(), 500));
        this.timeouts.push(setTimeout(() => (this.canClickAnywhere = true), 1200));

        this.timeouts.push(
            setTimeout(() => {
                if (SpinRoundBanner.currentInstance === this) {
                    if (this.canClickAnywhere) this.hide();
                }
            }, 6000),
        );
    }

    private clearTimeouts() {
        for (const t of this.timeouts) clearTimeout(t);
        this.timeouts = [];
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

    private getGlows(): Sprite[] {
        const arr: Sprite[] = [];
        if (this.glowA) arr.push(this.glowA);
        if (this.glowB) arr.push(this.glowB);
        return arr;
    }

    private rand(min: number, max: number) {
        return min + Math.random() * (max - min);
    }

    private buildCoinTextures() {
        return [
            Texture.from("coin-01"),
            Texture.from("coin-02"),
            Texture.from("coin-03"),
            Texture.from("coin-04"),
            Texture.from("coin-05"),
            Texture.from("coin-06"),
            Texture.from("coin-07"),
            Texture.from("coin-08"),
            Texture.from("coin-09"),
        ];
    }

    private startCoinBlast() {
        this.stopCoinBlast();
        this.coinBlastActive = true;

        const coinTextures = this.buildCoinTextures();

        const W = this.bg.width || 0;
        const H = this.bg.height || 0;
        if (W <= 0 || H <= 0) return;

        const isPortrait = H > W;
        if (isPortrait) {
            this.startCoinBlastPortrait(W, H, coinTextures);
        } else {
            this.startCoinBlastLandscape(W, H, coinTextures);
        }
    }

    private startCoinBlastLandscape(W: number, H: number, coinTextures: Texture[]) {
        const leftSpawnX = -60;
        const rightSpawnX = W + 60;

        const baseY = H * 0.78;
        const yJitter = 280;
        const bottomY = H + 140;

        const inwardClamp = W * 0.5;

        const makeCoin = (side: "L" | "R") => {
            const coin = new AnimatedSprite(coinTextures);
            coin.anchor.set(0.5);
            coin.animationSpeed = this.rand(0.25, 0.45);
            coin.scale.set(this.rand(0.5, 1.05));
            coin.rotation = this.rand(-Math.PI, Math.PI);

            coin.x = side === "L" ? leftSpawnX : rightSpawnX;
            coin.y = baseY - this.rand(0, yJitter);

            let vx = side === "L" ? this.rand(13, 24) : -this.rand(13, 24);
            let vy = -this.rand(16, 30);

            const gravity = this.rand(0.85, 1.25);
            const drag = this.rand(0.984, 0.992);
            const sway = this.rand(-0.35, 0.35);

            this.coinContainer.addChild(coin);

            const tween = gsap.to(coin, {
                duration: 999999,
                ease: "none",
                delay: this.rand(0, 0.9),
                onStart: () => coin.play(),
                onUpdate: () => {
                    vy += gravity;
                    vx *= drag;

                    coin.x += vx + sway;
                    coin.y += vy;

                    coin.rotation += (side === "L" ? 1 : -1) * this.rand(0.02, 0.06);

                    if (side === "L" && coin.x > inwardClamp - 70) {
                        coin.x = inwardClamp - 70;
                        vx *= 0.35;
                    }
                    if (side === "R" && coin.x < inwardClamp + 70) {
                        coin.x = inwardClamp + 70;
                        vx *= 0.35;
                    }

                    if (coin.y > bottomY) {
                        coin.scale.set(this.rand(0.5, 1.05));
                        coin.rotation = this.rand(-Math.PI, Math.PI);

                        coin.x = side === "L" ? leftSpawnX : rightSpawnX;
                        coin.y = baseY - this.rand(0, yJitter);

                        vx = side === "L" ? this.rand(13, 24) : -this.rand(13, 24);
                        vy = -this.rand(16, 30);
                    }
                },
            });

            (coin as any).coinTween = tween;
            return coin;
        };

        const LEFT_COUNT = 30;
        const RIGHT_COUNT = 30;

        for (let i = 0; i < LEFT_COUNT; i++) makeCoin("L");
        for (let i = 0; i < RIGHT_COUNT; i++) makeCoin("R");
    }

    private startCoinBlastPortrait(W: number, H: number, coinTextures: Texture[]) {
        const topY = -80;
        const bottomY = H + 80;

        const minX = W * 0.05;
        const maxX = W * 0.95;

        const makeCoin = () => {
            const coin = new AnimatedSprite(coinTextures);
            coin.anchor.set(0.5);
            coin.animationSpeed = this.rand(0.25, 0.45);
            coin.scale.set(this.rand(0.5, 1.0));
            coin.rotation = this.rand(-Math.PI, Math.PI);

            coin.x = this.rand(minX, maxX);
            coin.y = topY - this.rand(0, 120);

            let vx = this.rand(-1.8, 1.8);
            let vy = this.rand(4, 9);

            const gravity = this.rand(0.12, 0.28);
            const dragX = this.rand(0.985, 0.995);
            const sway = this.rand(-0.15, 0.15);

            this.coinContainer.addChild(coin);

            const tween = gsap.to(coin, {
                duration: 999999,
                ease: "none",
                delay: this.rand(0, 0.8),
                onStart: () => coin.play(),
                onUpdate: () => {
                    vy += gravity;
                    vx *= dragX;

                    coin.x += vx + sway;
                    coin.y += vy;

                    coin.rotation += this.rand(0.01, 0.035);

                    if (coin.x < minX) {
                        coin.x = minX;
                        vx = Math.abs(vx);
                    } else if (coin.x > maxX) {
                        coin.x = maxX;
                        vx = -Math.abs(vx);
                    }

                    if (coin.y > bottomY) {
                        coin.scale.set(this.rand(0.5, 1.0));
                        coin.rotation = this.rand(-Math.PI, Math.PI);

                        coin.x = this.rand(minX, maxX);
                        coin.y = topY - this.rand(0, 120);

                        vx = this.rand(-1.8, 1.8);
                        vy = this.rand(4, 9);
                    }
                },
            });

            (coin as any).coinTween = tween;
            return coin;
        };

        const COUNT = 60;
        for (let i = 0; i < COUNT; i++) makeCoin();
    }

    private stopCoinBlast() {
        this.coinBlastActive = false;

        for (const child of this.coinContainer.children) {
            const tw = (child as any).coinTween as gsap.core.Tween | undefined;
            if (tw) tw.kill();
            gsap.killTweensOf(child);
            gsap.killTweensOf((child as any).scale);
        }
        this.coinContainer.removeChildren();
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
        this.banner.visible = true;

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
            { max: 80, board: "green-banner-board", text: "green-banner-text", sfx: "common/sfx-avast.wav" },
            { max: 150, board: "blue-banner-board", text: "blue-banner-text", sfx: "common/sfx-avast.wav" },
            { max: Infinity, board: "red-banner-board", text: "red-banner-text", sfx: "common/sfx-avast.wav" },
        ];

        return bannerDict.find((x) => win < x.max)!;
    }

    private animateEntrance() {
        const tex = this.getBannerTexture(this.winValue);

        this.playBannerSfx(tex.sfx);

        gsap.killTweensOf([this.banner, this.headerText, this.valueText, ...this.getGlows()]);
        gsap.killTweensOf([this.headerText.scale, this.valueText.scale]);
        for (const g of this.getGlows()) gsap.killTweensOf(g);

        this.stopCoinBlast();

        if (this.glowEntranceTween) {
            this.glowEntranceTween.kill();
            this.glowEntranceTween = undefined;
        }
        if (this.glowOpacityTween) {
            this.glowOpacityTween.kill();
            this.glowOpacityTween = undefined;
        }

        const startOffset = -900;

        const finalBannerY = this.banner.y;
        const finalHeaderY = this.headerText.y;
        const finalValueY = this.valueText.y;

        this.syncGlowToBanner();

        for (const g of this.getGlows()) {
            g.alpha = 0;
            g.rotation = 0;
            g.scale.set(g === this.glowB ? this.glowBaseScale * 0.97 : this.glowBaseScale);
        }

        this.banner.alpha = 0;
        this.headerText.alpha = 0;
        this.valueText.alpha = 0;

        this.banner.y = finalBannerY + startOffset;
        this.headerText.y = finalHeaderY + startOffset;
        this.valueText.y = finalValueY + startOffset;

        gsap.to(this.banner, {
            alpha: 1,
            y: finalBannerY,
            duration: 0.7,
            ease: "bounce.out",
            onUpdate: () => {
                this.syncGlowToBanner();
            },
            onComplete: () => {
                this.syncGlowToBanner();
                this.showGlowEffects();
                this.startCoinBlast();
            },
        });

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

    private playBannerSfx(sfxKey: string) {
        try {
            sfx.play(sfxKey, { volume: 0.5 });
            // this.sfxCoinBlast = sfx.play("common/sfx-coin-fall.wav");
            this.sfxCoinBlast = sfx.playLoopTimes("common/sfx-coin-fall.wav", 2, );
        } catch (e) {
            console.warn("Failed to play banner SFX:", sfxKey, e);
        }
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

    private animateValue() {
        // ✅ ensure no previous instance/tween keeps running
        this.killValueTweenOnly();
        this.stopCollectWinSfx();

        this.currentDisplayValue = 0;

        // ✅ pixi sound volumes are typically 0..1 (avoid 3)
        this.sfxCollectWin = sfx.playSegment("common/sfx-win-rise.wav", 0, 2, {volume: 0.5});

        // ✅ store tween reference, so it can be killed on blur/hidden/hide()
        this.valueTween = gsap.to(this, {
            currentDisplayValue: this.targetDisplayValue,
            duration: 2,
            ease: "power2.out",
            onUpdate: () => {
                this.valueText.text = this.formatCurrency(this.currentDisplayValue);
            },
            onComplete: () => {
                this.valueTween = undefined;

                this.stopCollectWinSfx();

                gsap.fromTo(
                    this.valueText.scale,
                    { x: 0.85, y: 0.85 },
                    {
                        x: 1,
                        y: 1,
                        duration: 0.6,
                        ease: "elastic.out(1, 0.6)",
                        onComplete: () => this.animateValuePulse(),
                    },
                );
            },
        });
    }

    private killValueTweenOnly() {
        if (this.valueTween) {
            try {
                this.valueTween.kill();
            } catch {}
            this.valueTween = undefined;
        }
        // safety: kill any gsap tween targeting this object (amount tween is gsap.to(this, ...))
        gsap.killTweensOf(this);
    }

    private forceStopAllBannerAudio() {
        // stop both loop sounds, always safe
        try {
            this.sfxCoinBlast?.stop?.();
        } catch {}
        this.sfxCoinBlast = null;

        this.stopCollectWinSfx();
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

        if (this.getChildIndex(this.bg) !== 0) this.setChildIndex(this.bg, 0);
        if (this.getChildIndex(this.coinContainer) !== 1) this.setChildIndex(this.coinContainer, 1);
        if (this.getChildIndex(this.panel) !== 2) this.setChildIndex(this.panel, 2);

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.banner.scale.set(1.3);
        this.headerText.scale.set(0.9);
        this.valueText.scale.set(1);

        const gA = this.glowA;
        const gB = this.glowB;

        if (gA && gB) {
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

        // ✅ detach handlers
        document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
        window.removeEventListener("blur", this.onWindowBlurBound);

        this.clearTimeouts();

        // ✅ stop ANY audio owned by this banner no matter what
        this.forceStopAllBannerAudio();

        // ✅ also kill amount tween so onComplete can’t “revive” anything later
        this.killValueTweenOnly();

        gsap.killTweensOf(this.headerText.scale);
        gsap.killTweensOf(this.valueText.scale);

        this.stopCoinBlast();

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

        const dismissNow = () => {
            void navigation.dismissPopup().catch(() => {});
        };

        if (forceInstant) {
            this.alpha = 0;
            SpinRoundBanner.currentInstance = null;

            dismissNow();

            const cb = this.onClosed;
            this.onClosed = undefined;
            cb?.();
            return;
        }

        await gsap.to(
            [this.banner, this.headerText, this.valueText, this.bg, ...this.getGlows()].filter(Boolean),
            {
                alpha: 0,
                duration: 0.25,
            },
        );

        SpinRoundBanner.currentInstance = null;

        dismissNow();

        const cb = this.onClosed;
        this.onClosed = undefined;
        cb?.();
    }

    private stopCollectWinSfx() {
        if (this.sfxCollectWin) {
            try {
                this.sfxCollectWin.stop();
            } catch {}
            this.sfxCollectWin = null;
        }
    }
}
