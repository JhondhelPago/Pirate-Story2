import { List } from '@pixi/ui';
import { Container, Sprite } from 'pixi.js';
import { Label } from './Label';
import { IconButton } from './IconButton2';
import { i18n } from '../i18n/i18n';

export class BetSettings extends Container {
    private layout: List;
    private title: Label;
    private betContainer: Container; // <- now a Container
    private betSprite: Sprite; // <- store the actual Sprite
    private betAmountLabel: Label;

    private betButtonLayout: List;
    private minusButton: IconButton;
    private plusButton: IconButton;

    private onIncreaseBetPressed?: () => void;
    private onDecreaseBetPressed?: () => void;

    constructor() {
        super();

        this.layout = new List({ type: 'vertical', elementsMargin: 10 });
        this.addChild(this.layout);

        const titleContainer = new Container();
        this.title = new Label(i18n.t('totalBet'), {
            fill: '#FCC100',
            align: 'center',
        });
        this.title.anchor.set(0.5);
        this.title.anchor.y = 1.5;
        titleContainer.addChild(this.title);
        this.layout.addChild(titleContainer);

        // --- BET SPRITE + LABEL ---
        this.betContainer = new Container(); // <- container that can have children
        this.layout.addChild(this.betContainer);

        this.betSprite = Sprite.from('bet-container');
        this.betSprite.anchor.set(0.5);
        this.betContainer.addChild(this.betSprite);

        this.betAmountLabel = new Label('0', {
            fill: 0xffffff,
            fontSize: 25,
        });
        this.betAmountLabel.anchor.set(0.5);
        this.betContainer.addChild(this.betAmountLabel);

        // --- BUTTON LAYOUT ---
        this.betButtonLayout = new List({ type: 'horizontal', elementsMargin: 60 });
        this.layout.addChild(this.betButtonLayout);

        const minusButtonContainer = new Container();
        this.minusButton = new IconButton({
            imageDefault: 'icon-button-default-minus-bet-view',
            imageHover: 'icon-button-active-minus-bet-view',
            imagePressed: 'icon-button-active-minus-bet-view',
            imageDisabled: 'icon-button-disabled-minus-bet-view',
        });
        this.minusButton.anchor.set(0.5);
        this.minusButton.onPress.connect(() => this.onDecreaseBetPressed?.());
        minusButtonContainer.addChild(this.minusButton);
        this.betButtonLayout.addChild(minusButtonContainer);

        const plusButtonContainer = new Container();
        this.plusButton = new IconButton({
            imageDefault: 'icon-button-default-plus-bet-view',
            imageHover: 'icon-button-active-plus-bet-view',
            imagePressed: 'icon-button-active-plus-bet-view',
            imageDisabled: 'icon-button-disabled-plus-bet-view',
        });
        this.plusButton.anchor.set(0.5);
        this.plusButton.onPress.connect(() => this.onIncreaseBetPressed?.());
        plusButtonContainer.addChild(this.plusButton);
        this.betButtonLayout.addChild(plusButtonContainer);

        this.betButtonLayout.x = -58;
    }

    /** Register callback for increase bet button */
    public onIncreaseBet(callback: () => void) {
        this.onIncreaseBetPressed = callback;
    }

    /** Register callback for decrease bet button */
    public onDecreaseBet(callback: () => void) {
        this.onDecreaseBetPressed = callback;
    }

    public setup(enabled: boolean = true) {
        this.minusButton.enabled = enabled;
        this.plusButton.enabled = enabled;
    }

    /** Enable or disable bet buttons */
    public setEnabled(enabled: boolean) {
        this.minusButton.enabled = enabled;
        this.plusButton.enabled = enabled;
    }

    public get text(): string {
        return this.betAmountLabel.text;
    }

    public set text(v: string | number) {
        this.betAmountLabel.text = String(v);
    }
}
