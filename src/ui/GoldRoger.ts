import { Container } from 'pixi.js';
import gsap from 'gsap';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

export class GoldRoger extends Container {
    private zeus: Spine;
    private container: Container;
    private floatTimeline?: gsap.core.Timeline;

    constructor() {
        super();

        this.container = new Container();
        this.addChild(this.container);

        this.zeus = Spine.from({
            skeleton: 'game/mascot.json',
            atlas: 'game/mascot.atlas',
        });

        // Center properly (important for Spine)
        this.zeus.x = 0;
        this.zeus.y = 0;
        this.zeus.scale.set(1);
        this.zeus.pivot.set(
            this.zeus.width / 2,
            this.zeus.height / 2
        );

        this.container.addChild(this.zeus);

        // Optional: smooth transitions between animations
        this.zeus.state.data.setMix('idle', 'action', 0.2);
        this.zeus.state.data.setMix('action', 'idle', 0.2);

        this.setupFloat();
    }

    /** Floating idle movement (GSAP only, not Spine) */
    private setupFloat() {
        this.floatTimeline = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
        this.floatTimeline.to(this.container, {
            y: '-=10',
            duration: 1.5,
            ease: 'sine.inOut',
        });
    }

    /** Play idle Spine animation */
    public playIdle() {
        this.zeus.state.setAnimation(0, 'idle', true);
        this.floatTimeline?.play();
    }

    /** Play action animation once, then return to idle */
    public playAction() {
        this.floatTimeline?.pause();

        this.zeus.state.setAnimation(0, 'action', false);
        this.zeus.state.addAnimation(0, 'idle', true, 0);
    }

    /** Show the mascot */
    public async show(animated = true) {
        gsap.killTweensOf(this.container.scale);
        this.visible = true;

        if (animated) {
            this.container.scale.set(0);
            await gsap.to(this.container.scale, {
                x: 1,
                y: 1,
                duration: 0.3,
                ease: 'back.out',
            });
        } else {
            this.container.scale.set(1);
        }

        this.playIdle();
    }

    /** Hide the mascot */
    public async hide(animated = true) {
        gsap.killTweensOf(this.container.scale);
        this.floatTimeline?.pause();

        if (animated) {
            await gsap.to(this.container.scale, {
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'back.in',
            });
        } else {
            this.container.scale.set(0);
        }

        this.visible = false;
    }

    public destroy() {
        this.floatTimeline?.kill();
        super.destroy();
    }
}
