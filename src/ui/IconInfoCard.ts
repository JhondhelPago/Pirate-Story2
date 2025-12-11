import { Container, Sprite } from 'pixi.js';
import { Label } from './Label';

const defaultIconInfoCardOptions = {
    image: 'slot-placeholder',
    label: 'label',
    imageScale: 1,
    fontSize: 18,
    gap: 10, // Gap between image and text
};

export type IconInfoCardOptions = typeof defaultIconInfoCardOptions;

export class IconInfoCard extends Container {
    private image: Sprite;
    public text: Label;
    private gap: number;

    constructor(options: Partial<IconInfoCardOptions> = {}) {
        super();

        const opts = { ...defaultIconInfoCardOptions, ...options };
        this.gap = opts.gap;

        this.image = Sprite.from(opts.image);
        this.image.anchor.set(0.5);
        this.image.scale.set(opts.imageScale);
        this.addChild(this.image);

        this.text = new Label(opts.label, {
            fill: 0xffffff,
            fontSize: opts.fontSize,
            fontWeight: '200',
            wordWrap: true,
        });
        this.text.anchor.set(0, 0.5); // Center vertically, left align horizontally
        this.addChild(this.text);

        this.updateLayout();
    }

    /**
     * Recalculates and updates the layout positioning
     * Call this after changing fontSize or other properties that affect dimensions
     */
    public updateLayout(): void {
        // Calculate total width
        const totalWidth = this.image.width + this.gap + this.text.width;

        // Position image on the left, offset by half total width to center the group
        this.image.x = -totalWidth / 2 + this.image.width / 2;
        this.image.y = 0;

        // Position text to the right of the image with gap
        this.text.x = this.image.x + this.image.width / 2 + this.gap;
        this.text.y = 0;
    }
}
