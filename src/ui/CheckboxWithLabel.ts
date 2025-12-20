import { Container } from 'pixi.js';
import { Checkbox } from './Checkbox';
import { Label } from './Label';

const defaultCheckboxWithLabelOptions = {
    isChecked: false,
    label: '',
};

export type CheckboxWithLabelOptions = typeof defaultCheckboxWithLabelOptions;

export class CheckboxWithLabel extends Container {
    public checkbox: Checkbox;
    private container: Container;
    private messageLabel: Label;
    constructor(options: Partial<CheckboxWithLabelOptions> = {}) {
        super();

        const opts = { ...defaultCheckboxWithLabelOptions, ...options };

        this.container = new Container();
        this.addChild(this.container);

        this.checkbox = new Checkbox();
        this.checkbox.y = -(this.checkbox.height / 2);
        this.container.addChild(this.checkbox);

        this.messageLabel = new Label(opts.label, { fontSize: 25, fill: '#ffffff' });
        this.messageLabel.x = this.checkbox.width + 100;
        this.container.addChild(this.messageLabel);

        this.container.x = -200;
    }
}
