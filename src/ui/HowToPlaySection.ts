import { Container } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { IconInfoCard } from './IconInfoCard';

const defaultHowToPlaySectionOptions = {
    icons1: [
        {
            image: 'icon-button-minus-default-view',
            label: 'Button to decrease the bet value',
        },
        {
            image: 'icon-button-add-default-view',
            label: 'Button to increase the bet value',
        },
        {
            image: 'icon-button-autoplay-default-view',
            label: 'Button to autoplay spin',
        },
    ],
    icons2: [
        {
            image: 'icon-button-sound-on-default-view',
            label: 'Sound FX and Ambient Music ON Button',
        },
        {
            image: 'icon-button-sound-off-hover-view',
            label: 'Sound FX and Ambient Music OFF Button',
        },
        {
            image: 'icon-button-settings-default-view',
            label: 'Settings Button to display the game settings popup.',
        },
        {
            image: 'icon-button-info-default-view',
            label: 'Information Button to display the game informations popup.',
        },
    ],
};

export type HowToPlaySectionOptions = typeof defaultHowToPlaySectionOptions;
export class HowToPlaySection extends Container {
    private mainLayout: List;
    private topLayout: List;
    private bottomLayout: List;

    private secondTitleLabel: Label;
    private creditAndBetLabel: Label;

    private infoCards: IconInfoCard[] = [];

    constructor(opts: Partial<HowToPlaySectionOptions> = {}) {
        super();

        const options = { ...defaultHowToPlaySectionOptions, ...opts };

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 40 });
        this.addChild(this.mainLayout);

        this.topLayout = new List({ type: 'vertical', elementsMargin: 20 });
        options.icons1.forEach((icon) => {
            const card = new IconInfoCard({ image: icon.image, label: icon.label, imageScale: 0.75 });
            this.topLayout.addChild(card);
            this.infoCards.push(card);
        });
        this.mainLayout.addChild(this.topLayout);

        this.secondTitleLabel = new Label('Main Game Interface', {
            fill: '#FCC100',
        });
        this.mainLayout.addChild(this.secondTitleLabel);

        this.bottomLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.creditAndBetLabel = new Label('CREDITS and BET labels show the current balance and current total bet.', {
            fill: 0xffffff,
            fontSize: 18,
            fontWeight: '200',
            wordWrap: true,
            align: 'center',
        });
        this.bottomLayout.addChild(this.creditAndBetLabel);

        options.icons2.forEach((icon) => {
            const card = new IconInfoCard({ image: icon.image, label: icon.label, imageScale: 1 });
            this.bottomLayout.addChild(card);
            card.updateLayout();
            this.infoCards.push(card);
        });

        this.mainLayout.addChild(this.bottomLayout);
        console.log(this.mainLayout.elementsMargin);
    }

    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        let creditWrapWidth: number;
        let fontSize: number;
        let secondTitleFontSize: number;
        let cardWrapWidth: number;

        if (isMobile && isPortrait) {
            creditWrapWidth = 800;
            fontSize = 28;
            secondTitleFontSize = 36;
            cardWrapWidth = 600;
        } else if (isMobile && !isPortrait) {
            creditWrapWidth = 1200;
            fontSize = 28;
            secondTitleFontSize = 36;
            cardWrapWidth = 1200;
        } else {
            creditWrapWidth = 1000;
            fontSize = 18;
            secondTitleFontSize = 28;
            cardWrapWidth = 1000;
        }

        // Apply styles
        this.creditAndBetLabel.style.wordWrapWidth = creditWrapWidth;
        this.creditAndBetLabel.style.fontSize = fontSize;
        this.secondTitleLabel.style.fontSize = secondTitleFontSize;

        // Update cards
        for (const card of this.infoCards) {
            card.text.style.fontSize = fontSize;
            card.text.style.wordWrapWidth = cardWrapWidth;
            card.updateLayout();
        }

        // Layout positioning
        this.topLayout.elementsMargin = 20;
        this.bottomLayout.elementsMargin = 20;
        this.mainLayout.elementsMargin = 40;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.y = 60;
    }

    public async hide() {
        // Clean up info cards
        for (const card of this.infoCards) {
            card.destroy({ children: true });
        }
        this.infoCards = [];
    }
}
