import { Container, Text } from 'pixi.js';
import { formatCurrency } from '../utils/formatter';

export interface LabelValueConfig {
    labelText: string;
    fontSize: number;
    align: 'left' | 'right' | 'center'; // Add alignment option
}

/**
 * Reusable component for displaying a label with a formatted value
 * Auto-adapts width based on value length
 */
export class LabelValue extends Container {
    private container: Container;
    private labelText: Text;
    private valueText: Text;
    private currentValue: number = 0;

    private labelColor = 0xffffff;
    private valueColor = 0xffd700;
    private fontSize: number;
    private fontWeight: 'normal' | 'bold' | 'bolder' | 'lighter' = 'bold';
    private currency = 'usd';
    private align: 'left' | 'right' | 'center';

    constructor(config: LabelValueConfig) {
        super();

        this.fontSize = config.fontSize;
        this.align = config.align || 'left'; // Default to left

        this.container = new Container();
        this.addChild(this.container);

        this.labelText = new Text({
            text: config.labelText,
            style: {
                fontSize: this.fontSize,
                fill: this.labelColor,
                fontWeight: this.fontWeight,
                stroke: {
                    color: '#3a3a3a',
                    width: 1,
                },
            },
        });

        this.container.addChild(this.labelText);

        this.valueText = new Text({
            text: formatCurrency(0, this.currency),
            style: {
                fontSize: this.fontSize,
                fill: this.valueColor,
                fontWeight: this.fontWeight,
                stroke: {
                    color: '#3a3a3a',
                    width: 1,
                },
            },
        });

        this.container.addChild(this.valueText);

        this.applyAlignment();
        this.updateLayout();
    }

    public setCurrency(curr: string) {
        this.currency = curr;
    }

    public setValue(value: number, curr: string): void {
        if (!isFinite(value) || value < 0) {
            console.warn('[LabelValue] Invalid value:', value);
            value = 0;
        }

        this.currentValue = value;
        this.currency = curr;
        this.valueText.text = formatCurrency(value, this.currency);
        this.updateLayout();
    }

    public getValue(): number {
        return this.currentValue;
    }

    public setLabel(text: string): void {
        this.labelText.text = text;
        this.updateLayout();
    }

    /**
     * Set the text alignment for both label and value
     * @param align - 'left' | 'right' | 'center'
     */
    public setAlign(align: 'left' | 'right' | 'center'): void {
        this.align = align;
        this.applyAlignment();
        this.updateLayout();
    }

    /**
     * Get the current alignment
     */
    public getAlign(): 'left' | 'right' | 'center' {
        return this.align;
    }

    private applyAlignment(): void {
        // Set anchor based on alignment
        if (this.align === 'right') {
            this.labelText.anchor.set(1, 0); // Right-aligned
            this.valueText.anchor.set(1, 0);
        } else if (this.align === 'center') {
            this.labelText.anchor.set(0.5, 0); // Center-aligned
            this.valueText.anchor.set(0.5, 0);
        } else {
            this.labelText.anchor.set(0, 0); // Left-aligned (default)
            this.valueText.anchor.set(0, 0);
        }
    }

    private updateLayout(): void {
        const gap = 5;

        this.labelText.x = 0;
        this.labelText.y = 0;

        this.valueText.x = 0;
        this.valueText.y = this.labelText.y + this.labelText.height + gap;
    }

    public destroy(options?: any): void {
        this.container.destroy({ children: true });
        super.destroy(options);
    }
}
