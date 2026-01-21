import { Container, Sprite, Text, Texture, Matrix } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';
import { navigation } from '../utils/navigation';
import { BuyFreeSpinPopup } from '../popups/BuyFreeSpinPopup';
import { i18n } from '../i18n/i18n';

export class BuyFreeSpin extends Container {
    private floatWrapper: Container;
    private container: Container;
    private button: Sprite;
    private labelText: Text;

    private floatTimeline?: gsap.core.Timeline;

    private enabled = true;

    private enabledTween?: gsap.core.Tween;
    private readonly ENABLED_ALPHA = 1;
    private readonly DISABLED_ALPHA = 0.6;
    private readonly ENABLE_FADE_SEC = 0.18;

    // --------------------------
    // GRADIENT (STATIC / SHARED TEXTURE)
    // --------------------------
    private static labelGradientTexture?: Texture;

    constructor() {
        super();

        // --------------------------
        // FLOAT WRAPPER
        // --------------------------
        this.floatWrapper = new Container();
        this.addChild(this.floatWrapper);

        // --------------------------
        // MAIN CONTAINER
        // --------------------------
        this.container = new Container();
        this.floatWrapper.addChild(this.container);

        // --------------------------
        // BUTTON IMAGE
        // --------------------------
        this.button = Sprite.from('scroll-map-plain');
        this.button.anchor.set(0.5);
        this.container.addChild(this.button);

        // --------------------------
        // ENSURE LABEL GRADIENT TEXTURE
        // --------------------------
        this.ensureLabelGradient();

        // --------------------------
        // BUTTON LABEL
        // --------------------------
        this.labelText = new Text(i18n.t('buyFreeSpins'), {
            fontFamily: 'Pirata One',
            fontSize: 28,
            align: 'center',
            fill: 0xffffff, // ✅ temporary, will be replaced by gradient
            stroke: {
                color: 0x4c1b05,
                width: 4,
            },
        });

        this.labelText.anchor.set(0.5);
        this.labelText.position.set(0, this.button.height * 0.25);
        this.labelText.scale.set(2.5);
        this.labelText.eventMode = 'none';

        this.container.addChild(this.labelText);

        // ✅ Apply gradient AFTER scale + layout
        this.applyLabelGradient();

        this.setupInteractivity();

        // --------------------------
        // OPEN POPUP
        // --------------------------
        this.on('pointertap', () => {
            if (!this.enabled) return;

            navigation.presentPopup(BuyFreeSpinPopup, {
                onSelect: (value: number) => {
                    console.log('Selected Buy Free Spins:', value);
                },
            });
        });
    }

    // -------------------------------
    // GRADIENT CREATION (PRIVATE)
    // -------------------------------
    private ensureLabelGradient() {
        if (BuyFreeSpin.labelGradientTexture) return;

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;

        const ctx = canvas.getContext('2d')!;

        // ✅ Figma stops (exact)
        // NOTE: direction depends on what you want (see below)
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height); // vertical
        gradient.addColorStop(0.20, '#ECAC18');
        gradient.addColorStop(0.39, '#FFFFFF');
        gradient.addColorStop(0.44, '#FDD44F');
        gradient.addColorStop(0.50, '#FDD44F');
        gradient.addColorStop(0.70, '#D79600');
        gradient.addColorStop(1.0, '#FF7700');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        BuyFreeSpin.labelGradientTexture = Texture.from(canvas);
    }

    /**
     * ✅ Apply a gradient fill that correctly spans the text bounds.
     * This fixes the "flat fill" look when the text is scaled.
     */
    private applyLabelGradient() {
        this.ensureLabelGradient();

        // Local bounds in the text’s own space
        const b = this.labelText.getLocalBounds();

        // Option A (recommended): strictly vertical gradient like "gold text"
        // - ignores width; maps only Y so gradient is consistent even with different text lengths
        const m = new Matrix().translate(0, -b.y).scale(1, 1 / b.height);

        // Option B (if you want it to also vary across width):
        // const m = new Matrix().translate(-b.x, -b.y).scale(1 / b.width, 1 / b.height);

        (this.labelText.style as any).fill = {
            texture: BuyFreeSpin.labelGradientTexture!,
            matrix: m,
        };
    }

    // -------------------------------
    // ENABLE / DISABLE
    // -------------------------------
    public setEnabled(enabled: boolean) {
        if (this.enabled === enabled) return;

        this.enabled = enabled;
        this.visible = true;

        this.eventMode = enabled ? 'static' : 'none';
        this.cursor = enabled ? 'pointer' : 'default';

        if (this.enabledTween) this.enabledTween.kill();

        this.enabledTween = gsap.to(this, {
            alpha: enabled ? this.ENABLED_ALPHA : this.DISABLED_ALPHA,
            duration: this.ENABLE_FADE_SEC,
            ease: 'power2.out',
            overwrite: true,
        });

        if (!enabled) {
            gsap.killTweensOf(this.container.scale);
            this.container.scale.set(1);
        }
    }

    public isEnabled() {
        return this.enabled;
    }

    // -------------------------------
    // INTERACTION
    // -------------------------------
    private setupInteractivity() {
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerover', () => this.handleHover());
        this.on('pointerout', () => this.handleOut());
        this.on('pointerdown', () => this.handleDown());
    }

    private handleHover() {
        if (!this.enabled) return;

        sfx.play('common/sfx-hover.wav');

        gsap.killTweensOf(this.container.scale);
        gsap.to(this.container.scale, {
            x: 1.05,
            y: 1.05,
            duration: 0.2,
            ease: 'back.out',
        });
    }

    private handleOut() {
        if (!this.enabled) return;

        gsap.killTweensOf(this.container.scale);
        gsap.to(this.container.scale, {
            x: 1,
            y: 1,
            duration: 0.2,
            ease: 'back.out',
        });
    }

    private handleDown() {
        if (!this.enabled) return;

        sfx.play('common/sfx-press.wav');

        gsap.killTweensOf(this.container.scale);

        gsap.to(this.container.scale, {
            x: 0.95,
            y: 0.95,
            duration: 0.1,
            ease: 'power2.out',
        });

        gsap.to(this.container.scale, {
            x: 1.05,
            y: 1.05,
            duration: 0.2,
            delay: 0.1,
            ease: 'back.out',
        });
    }

    // -------------------------------
    // FLOATING
    // -------------------------------
    private startFloating() {
        if (this.floatTimeline) return;

        this.floatTimeline = gsap.timeline({ repeat: -1, yoyo: true });
        this.floatTimeline.to(this.floatWrapper, {
            y: -10,
            duration: 1.6,
            ease: 'sine.inOut',
        });
    }

    private stopFloating() {
        if (this.floatTimeline) {
            this.floatTimeline.kill();
            this.floatTimeline = undefined;
        }
        this.floatWrapper.y = 0;
    }

    // -------------------------------
    // SHOW / HIDE
    // -------------------------------
    public async show(animated = true) {
        this.visible = true;

        this.eventMode = this.enabled ? 'static' : 'none';
        this.cursor = this.enabled ? 'pointer' : 'default';

        if (this.enabledTween) this.enabledTween.kill();

        this.alpha = this.enabled ? this.ENABLED_ALPHA : this.DISABLED_ALPHA;

        this.stopFloating();

        if (animated) {
            this.container.alpha = 0;
            this.container.scale.set(1.5);

            gsap.to(this.container, { alpha: 1, duration: 0.3 });
            await gsap.to(this.container.scale, {
                x: 1,
                y: 1,
                duration: 0.3,
                ease: 'back.out',
            });
        } else {
            this.container.alpha = 1;
            this.container.scale.set(1);
        }

        // ✅ if fonts load late or resolution changes, re-apply gradient mapping
        this.applyLabelGradient();

        this.startFloating();
    }

    public async hide(animated = true) {
        this.eventMode = 'none';
        this.cursor = 'default';

        if (this.enabledTween) {
            this.enabledTween.kill();
            this.enabledTween = undefined;
        }

        this.stopFloating();

        if (animated) {
            gsap.to(this.container, { alpha: 0, duration: 0.3 });
            await gsap.to(this.container.scale, {
                x: 1.5,
                y: 1.5,
                duration: 0.3,
                ease: 'back.in',
            });
        } else {
            this.container.alpha = 0;
            this.container.scale.set(0);
        }

        this.visible = false;
    }
}
