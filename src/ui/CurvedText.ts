import { Container, Text, TextStyle } from 'pixi.js';

export interface CurvedTextOptions {
    /** The text content */
    text: string;
    /** Text style */
    style: Partial<TextStyle>;
    /** Curve radius (larger = less curved, default: 400) */
    radius?: number;
    /** Shadow offset X (default: 0) */
    shadowOffsetX?: number;
    /** Shadow offset Y (default: 4) */
    shadowOffsetY?: number;
    /** Shadow color (default: '#000000') */
    shadowColor?: string;
    /** Shadow alpha (default: 1) */
    shadowAlpha?: number;
    /** Letter spacing adjustment (default: 0) */
    letterSpacing?: number;
}

/**
 * A text component with letters arranged in a curve with shadow effect
 */
export class CurvedText extends Container {
    /** Container for shadow letters */
    private shadowContainer: Container;
    /** Container for main letters */
    private mainContainer: Container;
    /** The text content */
    private _text: string;
    /** Text style */
    private textStyle: Partial<TextStyle>;
    /** Curve configuration */
    private radius: number;
    private shadowOffsetX: number;
    private shadowOffsetY: number;
    private shadowColor: string;
    private shadowAlpha: number;
    private letterSpacing: number;

    constructor(options: CurvedTextOptions) {
        super();

        const {
            text,
            style,
            radius = 400,
            shadowOffsetX = 0,
            shadowOffsetY = 4,
            shadowColor = '#000000',
            shadowAlpha = 1,
            letterSpacing = 0,
        } = options;

        this._text = text;
        this.textStyle = style;
        this.radius = radius;
        this.shadowOffsetX = shadowOffsetX;
        this.shadowOffsetY = shadowOffsetY;
        this.shadowColor = shadowColor;
        this.shadowAlpha = shadowAlpha;
        this.letterSpacing = letterSpacing;

        this.shadowContainer = new Container();
        this.mainContainer = new Container();

        this.addChild(this.shadowContainer);
        this.addChild(this.mainContainer);

        this.createCurvedText();
    }

    /** Create the curved text effect */
    private createCurvedText() {
        // Clear existing letters
        this.shadowContainer.removeChildren();
        this.mainContainer.removeChildren();

        const letters = this._text.split('');

        // Create a temporary text to measure total width
        const tempText = new Text({ text: this._text, style: this.textStyle });
        const totalWidth = tempText.width + (letters.length - 1) * this.letterSpacing;
        tempText.destroy();

        // Calculate the angle span for the text
        const angleSpan = totalWidth / this.radius;
        const startAngle = -angleSpan / 2;

        let currentOffset = 0;

        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];

            // Create shadow letter
            const shadowStyle = { ...this.textStyle };
            delete shadowStyle.stroke;
            delete shadowStyle.dropShadow;

            const shadowLetter = new Text({
                text: letter,
                style: {
                    ...shadowStyle,
                    fill: this.shadowColor,
                },
            });
            shadowLetter.anchor.set(0.5);
            shadowLetter.alpha = this.shadowAlpha;

            // Create main letter
            const mainStyle = { ...this.textStyle };
            delete mainStyle.dropShadow;

            const mainLetter = new Text({
                text: letter,
                style: mainStyle,
            });
            mainLetter.anchor.set(0.5);

            // Calculate position on curve
            const letterWidth = mainLetter.width;
            const angle = startAngle + (currentOffset + letterWidth / 2) / this.radius;

            // Position on arc
            const x = Math.sin(angle) * this.radius;
            const y = -Math.cos(angle) * this.radius + this.radius;

            // Rotate letter to follow curve
            const rotation = angle;

            // Apply to shadow
            shadowLetter.x = x + this.shadowOffsetX;
            shadowLetter.y = y + this.shadowOffsetY;
            shadowLetter.rotation = rotation;

            // Apply to main letter
            mainLetter.x = x;
            mainLetter.y = y;
            mainLetter.rotation = rotation;

            this.shadowContainer.addChild(shadowLetter);
            this.mainContainer.addChild(mainLetter);

            currentOffset += letterWidth + this.letterSpacing;
        }

        // Center the containers horizontally and vertically
        const bounds = this.mainContainer.getLocalBounds();
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        this.mainContainer.x = -centerX;
        this.mainContainer.y = -centerY;
        this.shadowContainer.x = this.mainContainer.x;
        this.shadowContainer.y = this.mainContainer.y;
    }

    /** Update the text content */
    public setText(text: string) {
        this._text = text;
        this.createCurvedText();
    }

    /** Get the current text content */
    public getText(): string {
        return this._text;
    }

    /** Update the curve radius */
    public setRadius(radius: number) {
        this.radius = radius;
        this.createCurvedText();
    }

    /** Update text style */
    public setStyle(style: Partial<TextStyle>) {
        this.textStyle = style;
        this.createCurvedText();
    }

    /** Update letter spacing */
    public setLetterSpacing(spacing: number) {
        this.letterSpacing = spacing;
        this.createCurvedText();
    }
}
