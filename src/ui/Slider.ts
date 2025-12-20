import { Slider as PIXISlider } from '@pixi/ui';
import { Graphics } from 'pixi.js';
import { Label } from './Label';

const defaultSliderOptions = {
    text: '',
    min: 10,
    max: 1000,
    value: 10,
};

type SliderOptions = typeof defaultSliderOptions;

/**
 * A volume slider component to be used in the Settings popup.
 */
export class Slider extends PIXISlider {
    /** Message displayed for the slider */
    public messageLabel: Label;

    constructor(options: Partial<SliderOptions> = {}) {
        const opts = { ...defaultSliderOptions, ...options };
        const width = 470;
        const height = 10;
        const radius = 5;
        const border = 0;
        const borderColor = 0xcf4b00;
        const backgroundColor = 0xcf4b00;

        const bg = new Graphics()
            .roundRect(0, 0, width, height, radius)
            .fill(borderColor)
            .fill(backgroundColor)
            .roundRect(border, border, width - border * 2, height - border * 2, radius);

        const fill = new Graphics()
            .roundRect(0, 0, width, height, radius)
            .fill(borderColor)
            .roundRect(border, border, width - border * 2, height - border * 2, radius)
            .fill('#FCC100');

        const slider = new Graphics()
            .roundRect(-10, -25, 20, 50, radius)
            .fill(borderColor)
            .roundRect(-10, -25, 20, 50, radius)
            .fill('#FCC100');

        super({
            bg,
            fill,
            slider,
            min: opts.min,
            max: opts.max,
        });

        this.value = opts.value;

        // Set pivot to center the slider
        this.pivot.set(width / 2, -20);

        this.messageLabel = new Label(opts.text, {
            align: 'left',
            fill: 0xffffff,
            fontSize: 18,
        });
        this.messageLabel.anchor.set(0, 0.5);
        this.messageLabel.x = 0; // Left edge of slider (after pivot)
        this.messageLabel.y = -40; // Above the slider handle
        this.addChild(this.messageLabel);
    }

    public set text(text: string) {
        this.messageLabel.text = text;
    }
}
