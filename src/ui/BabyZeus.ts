import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

/**
 * Animated little Zeus sprite that shows up in Home and Result screens.
 */
export class BabyZeus extends Container {
    /** The Zeus sprite */
    private zeus: Spine;
    /** Inner container for internal animations */
    private container: Container;
    /** Float animation timeline */
    private floatTimeline?: gsap.core.Timeline;

    constructor() {
        super();

        this.container = new Container();
        this.addChild(this.container);

        // Create new spine animation
        this.zeus = Spine.from({
            skeleton: `game/mascot.json`,
            atlas: `game/mascot.atlas`,
        });
        // Center the spine
        this.zeus.x = 0;
        this.zeus.y = 0;
        this.zeus.pivot.set(0.5);

        this.container.addChild(this.zeus);
        this.playIdle();
    }

    /** Play floating idle animation */
    public playIdle() {
        this.zeus.state.setAnimation(0, 'animation', true);
    }

    /** Show the Zeus sprite */
    public async show(animated = true) {
        gsap.killTweensOf(this.container.scale);
        this.visible = true;
        if (animated) {
            this.container.scale.set(0);
            await gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
        } else {
            this.container.scale.set(1);
        }
        // Resume floating animation
        this.floatTimeline?.play();
    }

    /** Hide the Zeus sprite */
    public async hide(animated = true) {
        gsap.killTweensOf(this.container.scale);
        // Pause floating animation
        this.floatTimeline?.pause();

        if (animated) {
            await gsap.to(this.container.scale, { x: 0, y: 0, duration: 0.3, ease: 'back.in' });
        } else {
            this.container.scale.set(0);
        }
        this.visible = false;
    }

    /** Clean up animations */
    public destroy() {
        if (this.floatTimeline) {
            this.floatTimeline.kill();
        }
        super.destroy();
    }
}
