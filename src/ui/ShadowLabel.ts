import { Container, Text, TextStyle } from 'pixi.js';

export interface ShadowLabelOptions {
    /** The text content */
    text: string;
    /** Main text style */
    style: Partial<TextStyle>;
    /** Shadow offset X (default: 0) */
    shadowOffsetX?: number;
    /** Shadow offset Y (default: 4) */
    shadowOffsetY?: number;
    /** Shadow color (default: '#000000') */
    shadowColor?: string;
    /** Shadow alpha (default: 1) */
    shadowAlpha?: number;
}

/**
 * A label component with a shadow effect using duplicate text sprites.
 * More reliable than dropShadow, especially on mobile devices.
 */
export class ShadowLabel extends Container {
    /** The shadow text sprite */
    private shadowText: Text;
    /** The main text sprite */
    private mainText: Text;
    /** Shadow offset X */
    private _shadowOffsetX: number;
    /** Shadow offset Y */
    private _shadowOffsetY: number;

    constructor(options: ShadowLabelOptions) {
        super();

        const { text, style, shadowOffsetX = 0, shadowOffsetY = 4, shadowColor = '#000000', shadowAlpha = 1 } = options;

        this._shadowOffsetX = shadowOffsetX;
        this._shadowOffsetY = shadowOffsetY;

        // Create shadow text (without stroke)
        const shadowStyle = { ...style };
        delete shadowStyle.stroke;
        delete shadowStyle.dropShadow;

        this.shadowText = new Text({
            text,
            style: {
                ...shadowStyle,
                fill: shadowColor,
            },
        });
        this.shadowText.anchor.set(0.5);
        this.shadowText.alpha = shadowAlpha;
        this.shadowText.x = shadowOffsetX;
        this.shadowText.y = shadowOffsetY;
        this.addChild(this.shadowText);

        // Create main text
        const mainStyle = { ...style };
        delete mainStyle.dropShadow; // Remove dropShadow to avoid conflicts

        this.mainText = new Text({
            text,
            style: mainStyle,
        });
        this.mainText.anchor.set(0.5);
        this.addChild(this.mainText);
    }

    /** Update the text content */
    public set text(text: string) {
        this.shadowText.text = text;
        this.mainText.text = text;
    }

    /** Get the current text content */
    public get text(): string {
        return this.mainText.text;
    }

    /** Update the text style */
    public setStyle(style: Partial<TextStyle>) {
        const shadowStyle = { ...style };
        delete shadowStyle.stroke;
        delete shadowStyle.dropShadow;

        // Preserve shadow color
        if (this.shadowText.style.fill) {
            shadowStyle.fill = this.shadowText.style.fill;
        }

        this.shadowText.style = new TextStyle(shadowStyle);

        const mainStyle = { ...style };
        delete mainStyle.dropShadow;
        this.mainText.style = new TextStyle(mainStyle);
    }

    /** Update shadow offset */
    public setShadowOffset(x: number, y: number) {
        this._shadowOffsetX = x;
        this._shadowOffsetY = y;
        this.shadowText.x = x;
        this.shadowText.y = y;
    }

    /** Update shadow color */
    public setShadowColor(color: string | number) {
        this.shadowText.style.fill = color;
    }

    /** Update shadow alpha */
    public setShadowAlpha(alpha: number) {
        this.shadowText.alpha = alpha;
    }

    /** Get the main text sprite for direct manipulation if needed */
    public getMainText(): Text {
        return this.mainText;
    }

    /** Get the shadow text sprite for direct manipulation if needed */
    public getShadowText(): Text {
        return this.shadowText;
    }
}
