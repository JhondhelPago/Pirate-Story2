import { AnimatedSprite, Container, Sprite, Texture, Text, Matrix } from "pixi.js";
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

    // 🪙 coin effects container (blast + fall) - FULL SCREEN coords
    // ✅ lowest layer above bg, below panel so it never overlaps UI
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

    // ✅ Fix Timeout typing issue across envs (browser/node)
    private timeouts: Array<ReturnType<typeof setTimeout>> = [];

    private glowEntranceTween?: gsap.core.Tween;
    private glowOpacityTween?: gsap.core.Tween; // ✅ alternating opacity controller

    // coin blast controller
    private coinBlastActive = false;

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

        // ✅ coin layer goes right after bg (so it's always behind popup UI)
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

        this.winValue = anyData?.win ?? 0;
        this.targetDisplayValue = this.winValue;
        this.onClosed = anyData?.onClosed;

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
            }, 6500),
        );
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

    // 🪙 FULL SCREEN side blast: spawn at left/right edges of the popup screen
    // ✅ lives under panel (never overlaps banner/UI)
    private startCoinBlast() {
        if (this.coinBlastActive) return;
        this.coinBlastActive = true;

        this.stopCoinBlast();

        const coinTextures = this.buildCoinTextures();

        const W = this.bg.width || 0;
        const H = this.bg.height || 0;
        if (W <= 0 || H <= 0) return;

        const leftSpawnX = -60;
        const rightSpawnX = W + 60;

        const baseY = H * 0.78;      // a bit lower so it feels more “from the bottom”
        const yJitter = 280;
        const bottomY = H + 140;

        const inwardClamp = W * 0.5;

        const makeCoin = (side: "L" | "R") => {
            const coin = new AnimatedSprite(coinTextures);
            coin.anchor.set(0.5);
            coin.animationSpeed = this.rand(0.25, 0.45);
            coin.scale.set(this.rand(0.50, 1.05));
            coin.rotation = this.rand(-Math.PI, Math.PI);

            coin.x = side === "L" ? leftSpawnX : rightSpawnX;
            coin.y = baseY - this.rand(0, yJitter);

            // ✅ stronger burst spread + a bit more variation
            let vx = side === "L" ? this.rand(13, 24) : -this.rand(13, 24);
            let vy = -this.rand(16, 30);

            const gravity = this.rand(0.85, 1.25);
            const drag = this.rand(0.984, 0.992);
            const sway = this.rand(-0.35, 0.35);

            this.coinContainer.addChild(coin);

            const tween = gsap.to(coin, {
                duration: 999999,
                ease: "none",
                delay: this.rand(0, 0.9), // ✅ stagger start to look more “continuous”
                onStart: () => coin.play(),
                onUpdate: () => {
                    vy += gravity;
                    vx *= drag;

                    coin.x += vx + sway;
                    coin.y += vy;

                    coin.rotation += (side === "L" ? 1 : -1) * this.rand(0.02, 0.06);

                    // keep “side blast” feel
                    if (side === "L" && coin.x > inwardClamp - 70) {
                        coin.x = inwardClamp - 70;
                        vx *= 0.35;
                    }
                    if (side === "R" && coin.x < inwardClamp + 70) {
                        coin.x = inwardClamp + 70;
                        vx *= 0.35;
                    }

                    if (coin.y > bottomY) {
                        coin.scale.set(this.rand(0.50, 1.05));
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

        // ✅ MORE COINS
        // (Still safe because these are behind UI; tune if performance drops)
        const LEFT_COUNT = 30;
        const RIGHT_COUNT = 30;

        for (let i = 0; i < LEFT_COUNT; i++) makeCoin("L");
        for (let i = 0; i < RIGHT_COUNT; i++) makeCoin("R");
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
            { max: 80, board: "green-banner-board", text: "green-banner-text" },
            { max: 150, board: "blue-banner-board", text: "blue-banner-text" },
            { max: Infinity, board: "red-banner-board", text: "red-banner-text" },
        ];

        return bannerDict.find((x) => win < x.max)!;
    }

    private animateEntrance() {
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
                this.startCoinBlast(); // ✅ start after landing
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
        const A_MIN = 0.40;
        const B_MAX = 0.85;
        const B_MIN = 0.30;

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
                    },
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

        // ✅ keep layering: bg (0), coins (1), panel (2)
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

        for (const t of this.timeouts) clearTimeout(t);
        this.timeouts = [];

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
            [this.banner, this.headerText, this.valueText, this.bg, ...this.getGlows()].filter(Boolean),
            {
                alpha: 0,
                duration: 0.25,
            },
        );

        SpinRoundBanner.currentInstance = null;
        await navigation.dismissPopup();

        const cb = this.onClosed;
        this.onClosed = undefined;
        cb?.();
    }
}
