import { Container, Sprite, Ticker } from 'pixi.js';
import { app } from '../main';

/**
 * Island background with optional ship-like camera motion.
 * Motion is enabled only when focused (GameScreen active).
 */
export class IslandBackground extends Container {
    private bg!: Sprite;

    // motion state
    private elapsed = 0;
    private isMoving = false;

    // tuning (motion)
    private readonly bobAmplitude = 10;
    private readonly bobSpeed = 0.012;

    private readonly swayAmplitude = 12;
    private readonly swaySpeed = 0.008;

    private readonly tiltAmplitude = 0.002;
    private readonly tiltSpeed = 0.01;

    // overscan buffer
    private readonly overscanScale = 1.08;

    constructor() {
        super();
        this.init();
    }

    /** Create background sprite */
    private init() {
        this.bg = Sprite.from('Background');
        this.bg.anchor.set(0.5);

        this.addChild(this.bg);
        this.resize(app.screen.width, app.screen.height);
        this.resetTransform();
    }

    /* =========================
       AppScreen lifecycle hooks
       ========================= */

    /** Called by Navigation when screen becomes active */
    public focus() {
        this.isMoving = true;
    }

    /** Called when another screen / popup takes focus */
    public blur() {
        this.isMoving = false;
        this.resetTransform();
    }

    /** Navigation-managed update loop */
    public update(ticker: Ticker) {
        if (!this.isMoving) return;

        this.elapsed += ticker.deltaTime;

        const bobY =
            Math.sin(this.elapsed * this.bobSpeed) * this.bobAmplitude;

        const swayX =
            Math.cos(this.elapsed * this.swaySpeed) * this.swayAmplitude;

        const tilt =
            Math.sin(this.elapsed * this.tiltSpeed) * this.tiltAmplitude;

        this.bg.x = app.screen.width / 2 + swayX;
        this.bg.y = app.screen.height / 2 + bobY;
        this.bg.rotation = tilt;
    }

    /** Reset to perfect idle */
    private resetTransform() {
        this.elapsed = 0;
        this.bg.x = app.screen.width / 2;
        this.bg.y = app.screen.height / 2;
        this.bg.rotation = 0;
    }

    /** Resize background with overscan */
    public resize(width: number, height: number) {
        if (!this.bg) return;

        this.bg.x = width / 2;
        this.bg.y = height / 2;

        const scaleX = width / this.bg.texture.width;
        const scaleY = height / this.bg.texture.height;

        const scale = Math.max(scaleX, scaleY) * this.overscanScale;
        this.bg.scale.set(scale);
    }
}
