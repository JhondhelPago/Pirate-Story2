import { Color, FillGradient } from 'pixi.js';

// Create gradient fill
export const fillGradient = (gradientArray: number[]) => {
    const fill = new FillGradient(0, 0, 0, 2);

    const colors = gradientArray.map((color) => Color.shared.setValue(color).toNumber());

    colors.forEach((number, index) => {
        const ratio = index / colors.length;

        fill.addColorStop(ratio, number);
    });

    return fill;
};
