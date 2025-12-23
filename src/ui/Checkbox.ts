import { Container } from 'pixi.js';
import { Switcher } from '@pixi/ui';


export class Checkbox extends Container {
    public switcher: Switcher;
    public onChange: ((active: number | boolean) => void) | null = null;

    private _state = 0; // ← STORE IT HERE

    constructor() {
        super();

        this.switcher = new Switcher(['checkbox-default-btn', 'checkbox-active-btn']);
        this.addChild(this.switcher);

        this.switcher.onChange.connect((state: number | boolean) => {
            this._state = Number(state);
            this.onChange?.(state);
        });
    }

    /** Safe, typed accessor */
    get state(): number {
        return this._state;
    }

    /** Optional helper */
    get checked(): boolean {
        return this._state === 1;
    }
}
