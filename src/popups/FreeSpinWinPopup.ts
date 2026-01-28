import { AnimatedSprite, Container, FillGradient, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { navigation } from '../utils/navigation';
import { ShadowLabel } from '../ui/ShadowLabel';
import { registerCustomEase, resolveAndKillTweens } from '../utils/animation';
import { randomRange } from '../utils/random';

/** Custom ease curve for y animation of falling pieces - minimal bounce */
const easeSingleBounce = registerCustomEase(
    'M0,0,C0.14,0,0.27,0.191,0.352,0.33,0.43,0.462,0.53,0.963,0.538,1,0.546,0.997,0.672,0.97,0.778,0.97,0.888,0.97,0.993,0.997,1,1',
);

/** Popup displaying win amount with coin effects */
export class FreeSpinWinPopup extends Container {
    /** The dark semi-transparent background covering current screen */
    private bg: Sprite;
    /** Container for the popup UI components */
    private panel: Container;
    /** Container for coin effects */
    private coinContainer: Container;
    /** Left flying coin animation */
    private leftCoinAnimation: gsap.core.Tween;
    /** Right flying coin animation */
    private rightCoinAnimation: gsap.core.Tween;
    /** The first glow effect sprite */
    private glow1: Sprite;
    /** The second glow effect sprite */
    private glow2: Sprite;
    /** The arc panel background */
    private panelArc: Sprite;
    /** The modal text box */
    private textbox: Sprite;
    /** You have won text */
    private youHaveWon: ShadowLabel;
    /** Win amount text */
    private winAmount: ShadowLabel;
    /** Bottom text (IN X FREE SPINS) */
    private bottomText: ShadowLabel;
    /** Congratulations */
    private congratulations: ShadowLabel;
    /** click anywhere text */
    private clickAnywhere: ShadowLabel;
    /** click anywhere state */
    private canClickAnywhere = false;
    /** on click continue */
    private onPressConfirm?: () => void;
    /** Single combined glow and bounce animation timeline */
    private animationTimeline?: gsap.core.Timeline;
    /** Target win amount for counting animation */
    private targetWinAmount = 0;
    /** Current win amount for counting animation */
    private currentWinAmount = 0;
    /** Current win amount for counting animation */
    private spinsCount = 0;
    /** currency */
    private currency = '$';
    /** Counting animation tween reference */
    private countTween?: gsap.core.Tween;
    /** Count animation duration */
    private coutnAnimationDuration: number = 5;
    /** Flag to track if animation is skippable */
    private isSkippable = false;
    /** Screen height for calculating off-screen positions */
    private screenHeight = 0;

    constructor() {
        super();

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.interactive = true;
        this.bg.alpha = 0.8;
        this.addChild(this.bg);

        this.panel = new Container();
        this.addChild(this.panel);

        // Coin container - behind panel content but in front of glows
        this.coinContainer = new Container();
        this.panel.addChild(this.coinContainer);

        // First glow effect - behind everything
        this.glow1 = Sprite.from('glow');
        this.glow1.anchor.set(0.5);
        this.glow1.scale.set(2.8);
        this.glow1.y = -100;
        this.glow1.blendMode = 'add';
        this.panel.addChild(this.glow1);

        // Second glow effect - behind everything
        this.glow2 = Sprite.from('glow');
        this.glow2.anchor.set(0.5);
        this.glow2.scale.set(2.5);
        this.glow2.y = -100;
        this.glow2.blendMode = 'add';
        this.glow2.alpha = 0.7;
        this.panel.addChild(this.glow2);

        // Panel arc - in front of glows
        this.panelArc = Sprite.from('modal-panel-arc');
        this.panelArc.anchor.set(0.5);
        this.panel.addChild(this.panelArc);

        // TEXT GRADIENTS
        const verticalGradient1 = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#F2EDE8' },
                { offset: 1, color: '#D5CCC6' },
            ],
            textureSpace: 'local',
        });

        const verticalGradient2 = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#FFF3CE' },
                { offset: 1, color: '#E0A114' },
            ],
            textureSpace: 'local',
        });

        const verticalGradient3 = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#FDD44F' },
                { offset: 1, color: '#FF7700' },
            ],
            textureSpace: 'local',
        });

        // CONGRATULATIONS
        this.congratulations = new ShadowLabel({
            text: 'CONGRATULATIONS',
            style: {
                fill: verticalGradient3,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 90,
                stroke: {
                    width: 4,
                    color: '#000000',
                },
            },
            shadowOffsetY: 4,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.congratulations.y = -340;
        this.panel.addChild(this.congratulations);

        // YOU HAVE WON
        this.youHaveWon = new ShadowLabel({
            text: 'YOU HAVE WON',
            style: {
                fill: verticalGradient1,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 52,
                stroke: {
                    width: 2,
                    color: '#000000',
                },
            },
            shadowOffsetY: 6,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.youHaveWon.y = -60;
        this.panel.addChild(this.youHaveWon);

        // TEXTBOX
        this.textbox = Sprite.from('modal-textbox');
        this.textbox.anchor.set(0.5);
        this.textbox.y = 50;
        this.panel.addChild(this.textbox);

        // WIN AMOUNT
        this.winAmount = new ShadowLabel({
            text: `${this.currency}0.00`,
            style: {
                fill: verticalGradient2,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 60,
                stroke: {
                    width: 2,
                    color: '#000000',
                },
            },
            shadowOffsetY: 4,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.winAmount.y = this.textbox.y - 4;
        this.panel.addChild(this.winAmount);

        // BOTTOM TEXT (IN X FREE SPINS)
        this.bottomText = new ShadowLabel({
            text: `IN ${this.spinsCount} FREE SPINS`,
            style: {
                fill: verticalGradient1,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 40,
                stroke: {
                    width: 2,
                    color: '#000000',
                },
            },
            shadowOffsetY: 6,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.bottomText.y = 180;
        this.panel.addChild(this.bottomText);

        // CLICK ANYWHERE
        this.clickAnywhere = new ShadowLabel({
            text: 'Click anywhere to continue.',
            style: {
                fill: verticalGradient1,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 24,
                stroke: {
                    width: 2,
                    color: '#000000',
                },
            },
            shadowOffsetY: 4,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.addChild(this.clickAnywhere);

        // Add pointer event listeners
        this.bg.eventMode = 'static';
        this.eventMode = 'static';
        this.interactiveChildren = true;

        this.on('pointertap', () => {
            // If counting is active and skippable, skip it
            if (this.isSkippable && this.countTween) {
                this.skipCountingAnimation();
                return;
            }

            // Otherwise handle normal click
            if (!this.canClickAnywhere) return;
            this.onPressConfirm?.();
        });

        // Initialize with a dummy tween so the property is never undefined
        this.leftCoinAnimation = gsap.to({}, { duration: 0 });
        this.rightCoinAnimation = gsap.to({}, { duration: 0 });
    }

    private createFlyingCoins() {
        this.coinContainer.children.forEach((coin) => {
            resolveAndKillTweens(coin);
            resolveAndKillTweens(coin.scale);
        });

        // Create textures array for the 12 explosion frames
        const coinTextures = [
            Texture.from('coin-01'),
            Texture.from('coin-02'),
            Texture.from('coin-03'),
            Texture.from('coin-04'),
            Texture.from('coin-05'),
            Texture.from('coin-06'),
            Texture.from('coin-07'),
            Texture.from('coin-08'),
            Texture.from('coin-09'),
        ];

        // LEFTCOINS
        for (let count = 0; count < 10; count++) {
            const coin = new AnimatedSprite(coinTextures);
            let accelX = randomRange(12, 18); // Increased from 7.5-11.5
            let coinSpeed = 0.25; // Increased from 0.15
            const gravity = 0.25; // Increased from 0.15
            coin.scale.set(randomRange(0.75, 1));
            coin.anchor.set(0.5);
            coin.animationSpeed = randomRange(0.3, 0.5);
            coin.x = -coin.width;
            coin.y = this.bg.height - randomRange(100, 550);

            this.coinContainer.addChild(coin);

            this.leftCoinAnimation = gsap.to(coin, {
                rotation: Math.random() * 20,
                duration: 3,
                ease: 'sine.in',
                repeat: -1,
                delay: randomRange(0, 5),
                onStart: () => {
                    coin.play();
                },
                onUpdate: () => {
                    coin.y += coinSpeed;
                    coin.x += accelX;
                    coinSpeed += gravity;

                    if (accelX > 0) accelX -= gravity / 3;
                    if (accelX < 0) accelX = 0;

                    if (coin.y > this.bg.height) {
                        coinSpeed = 0.25; // Reset to faster speed
                        accelX = randomRange(12, 18); // Reset to faster speed
                        coin.y = this.bg.height - randomRange(100, 550);
                        coin.scale.set(randomRange(0.75, 1));
                        coin.x = -coin.width;
                        this.leftCoinAnimation?.repeat();
                    }
                },
            });
        }

        // RIGHTCOINS
        for (let count = 0; count < 10; count++) {
            const coin = new AnimatedSprite(coinTextures);
            let accelX = randomRange(12, 18); // Increased from 7.5-11.5
            let coinSpeed = 0.25; // Increased from 0.15
            const gravity = 0.25; // Increased from 0.15
            coin.scale.set(randomRange(0.75, 1));
            coin.anchor.set(0.5);
            coin.animationSpeed = randomRange(0.3, 0.5);
            coin.x = this.bg.width + coin.width;
            coin.y = this.bg.height - randomRange(100, 550);

            this.coinContainer.addChild(coin);

            this.rightCoinAnimation = gsap.to(coin, {
                rotation: Math.random() * 20,
                duration: 3,
                ease: 'sine.in',
                repeat: -1,
                delay: randomRange(0, 5),
                onStart: () => {
                    coin.play();
                },
                onUpdate: () => {
                    coin.y += coinSpeed;
                    coin.x -= accelX;
                    coinSpeed += gravity;

                    if (accelX > 0) accelX -= gravity / 3;
                    if (accelX < 0) accelX = 0;

                    if (coin.y > this.bg.height) {
                        coinSpeed = 0.25; // Reset to faster speed
                        accelX = randomRange(12, 18); // Reset to faster speed
                        coin.y = this.bg.height - randomRange(100, 550);
                        coin.scale.set(randomRange(0.75, 1));
                        coin.x = this.bg.width + coin.width;
                        this.rightCoinAnimation?.repeat();
                    }
                },
            });
        }
        this.addChild(this.coinContainer);
    }

    /** Animate counting up the win amount */
    private animateWinAmount() {
        this.currentWinAmount = 0;

        const countTween = gsap.to(this, {
            currentWinAmount: this.targetWinAmount,
            duration: this.coutnAnimationDuration,
            ease: 'power2.out',
            onUpdate: () => {
                const formatted = `${this.currency}${this.currentWinAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
                this.winAmount.text = formatted;
            },
            onComplete: () => {
                gsap.killTweensOf(this.winAmount.scale);

                gsap.fromTo(
                    this.winAmount.scale,
                    {
                        x: 0.85,
                        y: 0.85,
                    },
                    {
                        x: 1,
                        y: 1,
                        duration: 0.6,
                        ease: 'elastic.out(1, 0.6)',
                        onComplete: () => {
                            gsap.to(this.clickAnywhere, {
                                alpha: 1,
                                duration: 0.3,
                                ease: 'power2.out',
                            });
                            this.canClickAnywhere = true;
                            this.isSkippable = false;
                        },
                    },
                );
            },
        });

        this.countTween = countTween;
    }

    /** Skip the counting animation and show final amount */
    private skipCountingAnimation() {
        if (!this.countTween) return;

        // Complete the counting tween instantly
        this.countTween.progress(1);
        this.countTween.kill();
        this.countTween = undefined;

        // Set final amount
        this.currentWinAmount = this.targetWinAmount;
        const formatted = `${this.currency}${this.currentWinAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
        this.winAmount.text = formatted;

        // Do the final bounce
        gsap.killTweensOf(this.winAmount.scale);
        gsap.fromTo(
            this.winAmount.scale,
            { x: 0.6, y: 0.6 },
            {
                x: 1.2,
                y: 1.2,
                duration: 0.28,
                ease: 'back.out(4)', // hard punch
                onComplete: () => {
                    gsap.to(this.winAmount.scale, {
                        x: 0.95,
                        y: 0.95,
                        duration: 0.12,
                        ease: 'power2.inOut',
                    });

                    gsap.to(this.winAmount.scale, {
                        x: 1,
                        y: 1,
                        duration: 0.22,
                        ease: 'back.out(2)',
                    });

                    gsap.to(this.clickAnywhere, {
                        alpha: 1,
                        delay: 0.25,
                        duration: 0.3,
                        ease: 'power2.out',
                    });

                    this.canClickAnywhere = true;
                    this.isSkippable = false;
                },
            },
        );
    }

    /** Start all continuous animations in a single optimized timeline */
    private startContinuousAnimations() {
        if (this.animationTimeline) this.animationTimeline.kill();
        resolveAndKillTweens(this.glow1);
        resolveAndKillTweens(this.glow1.scale);
        resolveAndKillTweens(this.glow2);
        resolveAndKillTweens(this.glow2.scale);
        resolveAndKillTweens(this.congratulations.scale);

        this.animationTimeline = gsap.timeline({ repeat: -1 });

        this.animationTimeline.to(
            this.glow1,
            {
                rotation: Math.PI * 0.4,
                duration: 12,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: 1,
            },
            0,
        );
        this.animationTimeline.to(
            this.glow1.scale,
            {
                x: 3.2,
                y: 3.2,
                duration: 6,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: 1,
            },
            0,
        );

        this.animationTimeline.to(
            this.glow2,
            {
                rotation: -Math.PI * 0.3,
                duration: 14,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: 1,
            },
            0,
        );
        this.animationTimeline.to(
            this.glow2.scale,
            {
                x: 3.0,
                y: 3.0,
                duration: 7,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: 1,
            },
            0,
        );

        // Congratulations idle animation - gentle breathing scale
        this.animationTimeline.to(
            this.congratulations.scale,
            {
                x: 1.05,
                y: 1.05,
                duration: 1.5,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
            },
            0,
        );
    }

    /** Resize the popup, fired whenever window size changes */
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;
        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.clickAnywhere.x = width * 0.5;
        this.clickAnywhere.y = height - 64;

        this.screenHeight = height;
    }

    /** Set things up just before showing the popup */
    public prepare(data: any) {
        if (data) {
            this.targetWinAmount = data.winAmount;
            this.coutnAnimationDuration = 2;
            this.spinsCount = data.spinsCount;
            this.onPressConfirm = data.callBack;

            this.bottomText.text = `IN ${this.spinsCount} FREE SPINS`;
        }
    }

    /** Present the popup with improved entrance animation */
    public async show() {
        resolveAndKillTweens(this.bg);
        resolveAndKillTweens(this.panelArc);
        resolveAndKillTweens(this.panelArc.scale);
        resolveAndKillTweens(this.congratulations);
        resolveAndKillTweens(this.congratulations.scale);
        resolveAndKillTweens(this.glow1);
        resolveAndKillTweens(this.glow2);
        resolveAndKillTweens(this.youHaveWon);
        resolveAndKillTweens(this.youHaveWon.scale);
        resolveAndKillTweens(this.textbox);
        resolveAndKillTweens(this.textbox.scale);
        resolveAndKillTweens(this.winAmount);
        resolveAndKillTweens(this.winAmount.scale);
        resolveAndKillTweens(this.bottomText);
        resolveAndKillTweens(this.clickAnywhere);
        resolveAndKillTweens(this);
        this.coinContainer.removeChildren();

        this.panel.alpha = 1;
        this.clickAnywhere.alpha = 0;

        const offScreenY = -(this.screenHeight / 2 + this.panelArc.height);

        this.panelArc.alpha = 0;
        this.panelArc.scale.set(0.5);
        this.panelArc.y = offScreenY;

        this.glow1.alpha = 0;
        this.glow2.alpha = 0;

        this.congratulations.alpha = 0;
        this.congratulations.y = offScreenY - 200;
        this.congratulations.scale.set(0.8);

        this.youHaveWon.alpha = 0;
        this.youHaveWon.scale.set(0.8);

        this.textbox.alpha = 0;
        this.textbox.scale.set(0.5);
        this.winAmount.alpha = 0;
        this.winAmount.scale.set(0.5);
        this.winAmount.text = `${this.currency}0.00`;
        this.currentWinAmount = 0;

        this.bottomText.alpha = 0;
        this.bottomText.y = 220;

        this.createFlyingCoins();

        const entranceTl = gsap.timeline();

        entranceTl.to(
            this.panelArc,
            {
                alpha: 1,
                y: 0,
                rotation: 0,
                duration: 0.7,
                ease: easeSingleBounce,
            },
            0.1,
        );

        entranceTl.to(
            this.panelArc.scale,
            {
                x: 1,
                y: 1,
                duration: 0.5,
                ease: 'back.out(1.8)',
            },
            0.1,
        );

        entranceTl.to(this.congratulations, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0.6);
        entranceTl.to(
            this.congratulations,
            {
                y: -340,
                duration: 0.6,
                ease: easeSingleBounce,
            },
            0.6,
        );
        entranceTl.to(
            this.congratulations.scale,
            {
                x: 1,
                y: 1,
                duration: 0.4,
                ease: 'back.out(1.8)',
            },
            0.6,
        );

        entranceTl.to([this.glow1, this.glow2], { alpha: 1, duration: 0.3, ease: 'power2.out' }, 0.7);

        entranceTl.to(this.youHaveWon, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 0.85);
        entranceTl.to(
            this.youHaveWon.scale,
            {
                x: 1,
                y: 1,
                duration: 0.35,
                ease: 'elastic.out(1, 0.6)',
            },
            0.85,
        );

        entranceTl.to(this.textbox, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 1.05);
        entranceTl.to(
            this.textbox.scale,
            {
                x: 1,
                y: 1,
                duration: 0.4,
                ease: 'back.out(2)',
            },
            1.05,
        );

        entranceTl.to(this.winAmount, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 1.2);
        entranceTl.to(
            this.winAmount.scale,
            {
                x: 1,
                y: 1,
                duration: 0.5,
                ease: 'elastic.out(1, 0.5)',
            },
            1.2,
        );

        entranceTl.call(
            () => {
                this.isSkippable = true;
                this.animateWinAmount();
            },
            undefined,
            1.3,
        );

        entranceTl.to(this.bottomText, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 1.35);
        entranceTl.to(
            this.bottomText,
            {
                y: 180,
                duration: 0.4,
                ease: 'back.out(1.5)',
            },
            1.35,
        );

        await entranceTl;

        this.startContinuousAnimations();
    }

    /** Dismiss the popup, animated */
    public async hide() {
        this.isSkippable = false;
        this.canClickAnywhere = false;
        this.countTween = undefined;

        if (navigation.currentScreen) {
            navigation.currentScreen.filters = [];
        }

        const exitTl = gsap.timeline();
        exitTl.to(this.bg, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);
        exitTl.to(this.panel, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);
        exitTl.to(this.panel.scale, { x: 0.5, y: 0.5, duration: 0.3, ease: 'back.in(1.7)' }, 0);
        exitTl.to(this.clickAnywhere, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);

        await exitTl;

        this.coinContainer.removeChildren();
    }

    /** Clean up animations */
    public destroy() {
        if (this.animationTimeline) {
            this.animationTimeline.kill();
        }
        this.coinContainer.removeChildren();
        super.destroy();
    }
}
