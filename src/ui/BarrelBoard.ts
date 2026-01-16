import { Container, Sprite, Graphics } from 'pixi.js';

/**
 * BarrelBoard – A simple background board used behind the SlotPreview.
 * This behaves similarly to Pillar, but without panel graphics or spine animation.
 * Only draws a textured background or a colored rectangle.
 */
export class BarrelBoard extends Container {
    /** Background sprite (barrel board texture) */
    private bgSprite?: Sprite;

    /** Optional debug panel (if no texture is provided) */
    private debugPanel: Graphics;

    /** Path to background texture */
    private textureName: string;

    constructor(texture: string = 'Barrel-Board') {
        super();

        this.textureName = texture;

        // Debug fallback panel (in case texture is missing)
        this.debugPanel = new Graphics();
        this.addChild(this.debugPanel);

        // Try to create a sprite, but only if loaded
        try {
            this.bgSprite = Sprite.from(this.textureName);
            this.bgSprite.anchor.set(0.5);
            this.addChild(this.bgSprite);
        } catch {
            console.warn(`[BarrelBoard] Texture "${this.textureName}" not found, using debug panel.`);
        }
    }

    /** 🟢 RESET — identical concept to Pillar.reset() */
    public reset() {
        // Clear the debug panel
        this.debugPanel.clear();
        this.debugPanel.visible = false;

        // Hide the sprite instead of removing it (same idea as Pillar keeping spine)
        if (this.bgSprite) {
            this.bgSprite.visible = false;
        }
    }

    /**
     * Rebuilds the board based on match3 config
     * 🟢 Now follows the Pillar.setup() pattern
     */
    public setup(options: { rows: number; columns: number; tileSize: number }) {
        // Same pattern as Pillar:
        this.reset();

        const { rows, columns, tileSize } = options;

        const width = columns * tileSize;
        const height = rows * tileSize;

        // If texture exists → scale sprite
        if (this.bgSprite) {
            this.bgSprite.width = width + 560; // padding
            this.bgSprite.height = height + 110;
            this.bgSprite.visible = true;
        } else {
            // Draw fallback panel
            this.debugPanel.rect(-width / 2, -height / 2, width, height);
            this.debugPanel.fill(0x5b3412); // brown-ish
            this.debugPanel.visible = true;
        }
    }
}
