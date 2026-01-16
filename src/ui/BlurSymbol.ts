import { Sprite } from 'pixi.js';

/**
 * BlurSymbol — PNG version of SlotSymbol idle.
 * Uses Sprite.from() as requested.
 */
export class BlurSymbol extends Sprite {
    public type: number = 0;

    constructor(type: number, tileSize: number) {
        // ✔ Use Sprite.from(), and pass the resulting texture to super()
        const tex = Sprite.from(`blur_${type}`).texture;

        super(tex);

        this.type = type;

        // ✔ Match SlotSymbol spine pivot (center)
        this.anchor.set(0.5);

        // ✔ Match SlotSymbol scaling
        this.scale.set(0.45);

        // ✔ Match grid size
        this.width = tileSize * 0.93;
        this.height = tileSize * 1.2;

        this.alpha = 1;
    }
}
