import { Container } from 'pixi.js';
import { Switcher } from '@pixi/ui';

export class Checkbox extends Container {
    public switcher: Switcher;
    public onChange: ((active: number | boolean) => void) | null = null;

    constructor() {
        super();

        this.switcher = new Switcher(['checkbox-default-btn', 'checkbox-active-btn']);
        this.addChild(this.switcher);

        // Switcher is already interactive, so we listen to its onChange event
        this.switcher.onChange.connect((state: number | boolean) => {
            this.onChange?.(state);
        });
    }
}
