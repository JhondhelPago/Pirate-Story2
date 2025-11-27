import { Container, Graphics } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

/**
 * The pillar during gameplay, as background for match3 pieces. This can be dynamically
 * rescaled to any number of rows and columns, to match the game grid size.
 */
export class Pillar extends Container {
    /** Inner container for shelf building blocks */
    private base: Container;
    private panel: Graphics;
    private spine: Spine;

    constructor() {
        super();

        this.base = new Container();
        this.addChild(this.base);

        // Create white graphics panel
        this.panel = new Graphics();
        this.addChild(this.panel);

        // Create new spine animation
        this.spine = Spine.from({
            skeleton: `game/frame.json`,
            atlas: `game/frame.atlas`,
        });
        this.spine.state.setAnimation(0, 'animation', true);
        this.spine.state.timeScale = 0.3;
        this.spine.scale.set(1.1);
        this.addChild(this.spine);
    }

    /** Rebuild the pillar based on given rows, columns and tile size */
    public setup(options: { rows: number; columns: number; tileSize: number }) {
        this.reset();

        const rows = options.rows;
        const columns = options.columns;
        const tileSize = options.tileSize;

        // Calculate panel dimensions
        const panelWidth = columns * tileSize;
        const panelHeight = rows * tileSize;

        // Draw white panel behind the grid with extra width on sides
        const extraWidth = 50; // Adjust this value for more/less extra space
        this.panel.clear();
        this.panel.rect(-panelWidth / 2 - extraWidth, -panelHeight / 2, panelWidth + extraWidth * 2, panelHeight);
        this.panel.fill(0xffffff);

        // Center the spine animation
        this.spine.x = 0;
        this.spine.y = 0;
    }

    /** Remove all building blocks and clear the pillar */
    public reset() {
        this.base.removeChildren();
    }
}
