import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../utils/audio';
import { navigation } from '../utils/navigation';
import { BuyFreeSpinPopup } from '../popups/BuyFreeSpinPopup';

export class BuyFreeSpin extends Container {
    private floatWrapper: Container;   // NEW LAYER
    private container: Container;      // Your original container
    private button: Sprite;

    private floatTimeline?: gsap.core.Timeline;

    private enabled = true;

    // ✅ NEW: smooth enabled/disabled transition
    private enabledTween?: gsap.core.Tween;
    private readonly ENABLED_ALPHA = 1;
    private readonly DISABLED_ALPHA = 0.6;
    private readonly ENABLE_FADE_SEC = 0.18;

    constructor() {
        super();

        // --------------------------
        // FLOAT WRAPPER (Moves up/down)
        // --------------------------
        this.floatWrapper = new Container();
        this.addChild(this.floatWrapper);

        // --------------------------
        // MAIN UI CONTAINER (Scales on hover)
        // --------------------------
        this.container = new Container();
        this.floatWrapper.addChild(this.container);

        // --------------------------
        // BUTTON IMAGE
        // --------------------------
        this.button = Sprite.from('scroll-map');
        this.button.anchor.set(0.5);
        this.container.addChild(this.button);

        this.setupInteractivity();

        // OPEN POPUP (guarded by enabled)
        this.on('pointertap', () => {
            if (!this.enabled) return;

            navigation.presentPopup(BuyFreeSpinPopup, {
                onSelect: (value: number) => {
                    console.log("Selected Buy Free Spins:", value);
                }
            });
        });
    }

    /**
     * ✅ Enable/disable interaction WITHOUT hiding the button.
     * Visible stays true (unless you explicitly call hide()).
     * ✅ NOW: fades alpha smoothly instead of snapping.
     */
    public setEnabled(enabled: boolean) {
        // no-op if unchanged
        if (this.enabled === enabled) return;

        this.enabled = enabled;

        // keep visible as requested
        this.visible = true;

        // ✅ Input gating is immediate (game rules)
        this.eventMode = enabled ? 'static' : 'none';
        this.cursor = enabled ? 'pointer' : 'default';

        // ✅ Smooth visual transition
        if (this.enabledTween) this.enabledTween.kill();

        this.enabledTween = gsap.to(this, {
            alpha: enabled ? this.ENABLED_ALPHA : this.DISABLED_ALPHA,
            duration: this.ENABLE_FADE_SEC,
            ease: 'power2.out',
            overwrite: true,
        });

        // ✅ If disabling, ensure it doesn't stay scaled up from hover
        if (!enabled) {
            gsap.killTweensOf(this.container.scale);
            this.container.scale.set(1);
        }
    }

    public isEnabled() {
        return this.enabled;
    }

    // -------------------------------
    // INTERACTION HANDLERS
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
        gsap.to(this.container.scale, { x: 1.05, y: 1.05, duration: 0.2, ease: 'back.out' });
    }

    private handleOut() {
        if (!this.enabled) return;

        gsap.killTweensOf(this.container.scale);
        gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out' });
    }

    private handleDown() {
        if (!this.enabled) return;

        sfx.play('common/sfx-press.wav');

        gsap.killTweensOf(this.container.scale);

        gsap.to(this.container.scale, { x: 0.95, y: 0.95, duration: 0.1, ease: 'power2.out' });
        gsap.to(this.container.scale, { x: 1.05, y: 1.05, duration: 0.2, delay: 0.1, ease: 'back.out' });
    }

    // -------------------------------
    // FLOAT ANIMATION
    // -------------------------------
    private startFloating() {
        if (this.floatTimeline) return; // already running

        this.floatTimeline = gsap.timeline({ repeat: -1, yoyo: true });

        this.floatTimeline.to(this.floatWrapper, {
            y: -10,
            duration: 1.6,
            ease: "sine.inOut",
        });
    }

    private stopFloating() {
        if (this.floatTimeline) {
            this.floatTimeline.kill();
            this.floatTimeline = undefined;
        }
        this.floatWrapper.y = 0; // reset to original
    }

    // -------------------------------
    // SHOW / HIDE WITH FLOATING
    // -------------------------------
    public async show(animated = true) {
        this.visible = true;

        // ✅ keep current enabled state
        this.eventMode = this.enabled ? 'static' : 'none';
        this.cursor = this.enabled ? 'pointer' : 'default';

        // ✅ ensure any enabled tween doesn't fight show animation
        if (this.enabledTween) this.enabledTween.kill();

        // set to correct alpha immediately on show
        this.alpha = this.enabled ? this.ENABLED_ALPHA : this.DISABLED_ALPHA;

        this.stopFloating();

        if (animated) {
            this.container.alpha = 0;
            this.container.scale.set(1.5);

            gsap.to(this.container, { alpha: 1, duration: 0.3 });
            await gsap.to(this.container.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
        } else {
            this.container.alpha = 1;
            this.container.scale.set(1);
        }

        this.startFloating();
    }

    public async hide(animated = true) {
        // hide means truly invisible
        this.eventMode = 'none';
        this.cursor = 'default';

        // ✅ stop enabled tween so it won't re-apply alpha mid-hide
        if (this.enabledTween) {
            this.enabledTween.kill();
            this.enabledTween = undefined;
        }

        this.stopFloating();

        if (animated) {
            gsap.to(this.container, { alpha: 0, duration: 0.3 });
            await gsap.to(this.container.scale, { x: 1.5, y: 1.5, duration: 0.3, ease: 'back.in' });
        } else {
            this.container.alpha = 0;
            this.container.scale.set(0);
        }

        this.visible = false;
    }
}
