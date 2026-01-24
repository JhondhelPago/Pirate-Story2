import { Container } from 'pixi.js';
import gsap from 'gsap';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

/**
 * The game logo, presented in the Home screen
 */
export class GameLogo extends Container {
    private logo: Spine;

    constructor() {
        super();

        this.logo = Spine.from({
            skeleton: 'game/logo.json',
            atlas: 'game/logo.atlas',
        });

        // Center properly
        this.logo.x = 0;
        this.logo.y = 0;
        this.logo.scale.set(1.2);
        this.logo.pivot.set(
            this.logo.width / 2,
            this.logo.height / 2
        );

        this.addChild(this.logo);

        // Play animation named "animation"
        this.logo.state.setAnimation(0, 'animation', true);
    }

    /** Show the component */
    public async show(animated = true) {
        gsap.killTweensOf(this.logo.scale);
        this.visible = true;

        if (animated) {
            this.logo.scale.set(0);
            await gsap.to(this.logo.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.3,
                ease: 'back.out',
            });
        } else {
            this.logo.scale.set(1.2);
        }

        this.logo.state.setAnimation(0, 'animation', true);
    }

    /** Hide the component */
    public async hide(animated = true) {
        gsap.killTweensOf(this.logo.scale);

        if (animated) {
            await gsap.to(this.logo.scale, {
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'back.in',
            });
        } else {
            this.logo.scale.set(0);
        }

        this.visible = false;
    }
}
