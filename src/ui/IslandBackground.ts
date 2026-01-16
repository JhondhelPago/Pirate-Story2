import { Container, Sprite } from 'pixi.js';
import { app } from '../main';

/**
 * Simple full-screen background that auto-scales to cover the screen.
 * Uses Sprite.from() for instant creation (texture must be preloaded).
 */
export class IslandBackground extends Container {
    private bg!: Sprite;

    constructor() {
        super();
        this.init();
    }

    /** Create background sprite */
    private init() {
        // 👉 Replace "island_bg" with your actual name
        this.bg = Sprite.from('Background');
        this.bg.anchor.set(0.5); // center

        this.addChild(this.bg);

        this.resize(app.screen.width, app.screen.height);
    }

    /**
     * Resize background to always cover the screen (like CSS background-size: cover)
     */
    public resize(width: number, height: number) {
        if (!this.bg) return;

        this.bg.x = width / 2;
        this.bg.y = height / 2;

        // Scale to cover the screen while keeping aspect ratio
        const scaleX = width / this.bg.texture.width;
        const scaleY = height / this.bg.texture.height;

        const scale = Math.max(scaleX, scaleY);
        this.bg.scale.set(scale);
    }
}
