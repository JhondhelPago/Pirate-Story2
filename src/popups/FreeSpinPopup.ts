import { Container, FillGradient, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { navigation } from '../utils/navigation';
import { ShadowLabel } from '../ui/ShadowLabel';
import { registerCustomEase, resolveAndKillTweens } from '../utils/animation';

/** Custom ease curve for y animation of falling pieces - minimal bounce */
const easeSingleBounce = registerCustomEase(
    'M0,0,C0.14,0,0.27,0.191,0.352,0.33,0.43,0.462,0.53,0.963,0.538,1,0.546,0.997,0.672,0.97,0.778,0.97,0.888,0.97,0.993,0.997,1,1',
);

/** Popup with some info about the project */
export class FreeSpinPopup extends Container {
    /** The dark semi-transparent background covering current screen */
    private bg: Sprite;
    /** Container for the popup UI components */
    private panel: Container;
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
    /** Free Spins text */
    private freeSpins: ShadowLabel;
    /** Free Spins count */
    private spins: ShadowLabel;
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

    constructor() {
        super();

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.interactive = true;
        this.bg.alpha = 0.8;
        this.addChild(this.bg);

        this.panel = new Container();
        this.addChild(this.panel);

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

        // SPINS NUMBER
        this.spins = new ShadowLabel({
            text: '15',
            style: {
                fill: verticalGradient2,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 70,
                stroke: {
                    width: 2,
                    color: '#000000',
                },
            },
            shadowOffsetY: 4,
            shadowColor: '#000000',
            shadowAlpha: 1,
        });
        this.spins.y = this.textbox.y - 4;
        this.panel.addChild(this.spins);

        // FREE SPINS
        this.freeSpins = new ShadowLabel({
            text: 'FREE SPINS',
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
        this.freeSpins.y = 180;
        this.panel.addChild(this.freeSpins);

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
            if (!this.canClickAnywhere) return;
            this.onPressConfirm?.();
        });
    }

    /** Start all continuous animations in a single optimized timeline */
    private startContinuousAnimations() {
        if (this.animationTimeline) this.animationTimeline.kill();

        this.animationTimeline = gsap.timeline({ repeat: -1 });

        // Glow 1 rotation and scale
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

        // Glow 2 rotation and scale (opposite direction, different timing)
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
                repeat: 1,
            },
            0,
        );

        // // Optional: Add subtle float motion
        // this.animationTimeline.to(
        //     this.congratulations,
        //     {
        //         y: -345,
        //         duration: 2,
        //         ease: 'sine.inOut',
        //         yoyo: true,
        //         repeat: 1,
        //     },
        //     0,
        // );
    }

    /** Resize the popup, fired whenever window size changes */
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;
        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.clickAnywhere.x = width * 0.5;
        this.clickAnywhere.y = height - 64;

        // Store screen height for animation
        this.screenHeight = height;
    }

    /** Screen height for calculating off-screen positions */
    private screenHeight = 0;

    /** Set things up just before showing the popup */
    public prepare(data: any) {
        if (data) {
            this.onPressConfirm = data;
        }
    }

    /** Present the popup with improved entrance animation */
    public async show() {
        // Kill all tweens
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
        resolveAndKillTweens(this.spins);
        resolveAndKillTweens(this.spins.scale);
        resolveAndKillTweens(this.freeSpins);
        resolveAndKillTweens(this.clickAnywhere);

        // Start continuous animations
        this.startContinuousAnimations();

        // Set initial states
        this.panel.alpha = 1;
        this.clickAnywhere.alpha = 0;

        // Calculate off-screen position (above visible area)
        const offScreenY = -(this.screenHeight / 2 + this.panelArc.height);

        // Arc starts from very top of screen, completely hidden
        this.panelArc.alpha = 0;
        this.panelArc.scale.set(0.5); // Start smaller for more dramatic growth
        this.panelArc.y = offScreenY;

        // Glows hidden
        this.glow1.alpha = 0;
        this.glow2.alpha = 0;

        // Congratulations hidden above screen
        this.congratulations.alpha = 0;
        this.congratulations.y = offScreenY - 200;
        this.congratulations.scale.set(0.8);

        // You Have Won hidden
        this.youHaveWon.alpha = 0;
        this.youHaveWon.scale.set(0.8);

        // Textbox and spins hidden, scaled down
        this.textbox.alpha = 0;
        this.textbox.scale.set(0.5);
        this.spins.alpha = 0;
        this.spins.scale.set(0.5);

        // Free Spins hidden below
        this.freeSpins.alpha = 0;
        this.freeSpins.y = 220;

        // Create entrance timeline
        const entranceTl = gsap.timeline();

        // Arc falls from top with custom bounce
        // Arc falls from top with improved physics
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

        // Arc scale grows as it falls (creates sense of approaching)
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

        // Congratulations drops with custom bounce
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

        // Glows fade in as arc lands
        entranceTl.to([this.glow1, this.glow2], { alpha: 1, duration: 0.3, ease: 'power2.out' }, 0.7);

        // You Have Won pops in
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

        // Textbox zooms in
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

        // Spins number pops with elastic bounce
        entranceTl.to(this.spins, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 1.2);
        entranceTl.to(
            this.spins.scale,
            {
                x: 1,
                y: 1,
                duration: 0.5,
                ease: 'elastic.out(1, 0.5)',
            },
            1.2,
        );

        // Free Spins slides up
        entranceTl.to(this.freeSpins, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 1.35);
        entranceTl.to(
            this.freeSpins,
            {
                y: 180,
                duration: 0.4,
                ease: 'back.out(1.5)',
            },
            1.35,
        );

        // // Click anywhere fades in last
        entranceTl.to(this.clickAnywhere, { alpha: 1, duration: 0.3, ease: 'power2.out' }, 1.6);

        await entranceTl;

        this.canClickAnywhere = true;
    }

    /** Dismiss the popup, animated */
    public async hide() {
        if (navigation.currentScreen) {
            navigation.currentScreen.filters = [];
        }

        const exitTl = gsap.timeline();
        exitTl.to(this.bg, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);
        exitTl.to(this.panel, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);
        exitTl.to(this.panel.scale, { x: 0.5, y: 0.5, duration: 0.3, ease: 'back.in(1.7)' }, 0);
        exitTl.to(this.clickAnywhere, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0);

        await exitTl;
    }

    /** Clean up animations */
    public destroy() {
        if (this.animationTimeline) {
            this.animationTimeline.kill();
        }
        super.destroy();
    }
}
