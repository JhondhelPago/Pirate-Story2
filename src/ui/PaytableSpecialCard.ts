import { List } from '@pixi/ui';
import { Container, Sprite } from 'pixi.js';
import { Label } from './Label';

const defaultPaytableSpecialCardOptions = {
    image: 'symbol-0',
    description: '',
};

export type PaytableSpecialCardOptions = typeof defaultPaytableSpecialCardOptions;

export class PaytableSpecialCard extends Container {
    private image: Sprite;
    private labelMessage: Label;
    private mainLayout: List;

    constructor(options: Partial<PaytableSpecialCardOptions> = {}) {
        super();
        const opts = { ...defaultPaytableSpecialCardOptions, ...options };

        this.mainLayout = new List({ type: 'horizontal', elementsMargin: 10 });
        this.addChild(this.mainLayout);

        this.image = Sprite.from(opts.image);
        this.image.anchor.set(0, 0.5);
        this.image.scale.set(0.45);
        this.mainLayout.addChild(this.image);

        this.labelMessage = new Label(opts.description, {
            fill: '#ffffff',
            fontSize: 18,
            align: 'left',
            fontWeight: '200',
        });
        this.labelMessage.anchor.set(0, 0.5);
        this.mainLayout.addChild(this.labelMessage);

        this.mainLayout.pivot.set(this.mainLayout.width / 2, this.mainLayout.height / 2);
        this.mainLayout.y = 140;
    }

    public set fontSize(size: number) {
        this.labelMessage.style.fontSize = size;
        this.mainLayout.elementsMargin = 10;
        this.mainLayout.pivot.set(this.mainLayout.width / 2, this.mainLayout.height / 2);
    }
}
