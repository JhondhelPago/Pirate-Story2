import { Container, Sprite, Text } from 'pixi.js';
import { Label } from './Label';
import { List } from '@pixi/ui';
import { formatCurrency } from '../utils/formatter';
import { waitFor } from '../utils/asyncUtils';
import { resolveAndKillTweens } from '../utils/animation';
import gsap from 'gsap';

const defaultMatchPatternOptions = {
    image: 'symbol-0',
    times: 0,
    amount: 0,
    currency: 'usd',
};

export type MatchPatternOptions = typeof defaultMatchPatternOptions;

export class MatchPattern extends Container {
    private image: Sprite;
    private xTimes: Label;
    private text: Label;
    private layout: List;
    private currency: string;

    constructor(options: Partial<MatchPatternOptions> = {}) {
        super();
        const opts = { ...defaultMatchPatternOptions, ...options };
        this.alpha = 0;

        this.currency = opts.currency;
        this.layout = new List({ type: 'vertical' });

        this.xTimes = new Text({
            text: `${opts.times}x`,
            style: {
                fill: 0xffffff,
                fontSize: 32,
                fontWeight: '200',
            },
        });
        this.layout.addChild(this.xTimes);

        this.image = Sprite.from(opts.image);
        this.image.scale.set(0.15);
        this.image.anchor.y = 0;
        this.layout.addChild(this.image);

        this.text = new Text({
            text: `PAYS ${formatCurrency(opts.amount, opts.currency)}`,
            style: {
                fill: 0xffffff,
                fontSize: 32,
                fontWeight: '200',
            },
        });
        this.layout.addChild(this.text);

        this.addChild(this.layout);

        // Force layout to arrange children and calculate width
        this.layout.elementsMargin = 10;
        this.layout.type = 'horizontal';
    }

    public setup(times: number, symbol: string, amount: number, currency: string) {
        this.currency = currency;
        // Update times
        this.xTimes.text = `${times}x`;
        this.image.texture = Sprite.from(symbol).texture;
        this.text.text = `PAYS ${formatCurrency(amount, this.currency)}`;

        this.layout.elementsMargin = 10;
        this.layout.type = 'horizontal';

        resolveAndKillTweens(this);
        this.alpha = 0;
    }

    public async show(): Promise<void> {
        this.alpha = 0;
        await gsap.to(this, {
            alpha: 1,
            duration: 0.3,
            ease: 'power2.out',
        });

        // Wait
        await waitFor(2);

        // Fade out
        await gsap.to(this, {
            alpha: 0,
            duration: 0.3,
            ease: 'power2.in',
        });
    }

    public hide(): void {
        resolveAndKillTweens(this);
        this.alpha = 0;
    }
}
