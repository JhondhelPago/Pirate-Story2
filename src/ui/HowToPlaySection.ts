import { Container } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { IconInfoCard } from './IconInfoCard';
import { i18n } from '../i18n/i18n';
import type { I18nKey } from '../i18n/i18n';

/**
 * Strongly typed icon option
 */
type IconOption = {
    image: string;
    labelKey: I18nKey;
};

/**
 * Strongly typed options
 */
type HowToPlaySectionOptionsInternal = {
    icons1: IconOption[];
    icons2: IconOption[];
};

/**
 * Default options (store KEYS, not translated strings)
 */
const defaultHowToPlaySectionOptions: HowToPlaySectionOptionsInternal = {
    icons1: [
        {
            image: 'icon-button-minus-default-view',
            labelKey: 'minusButtonDesc',
        },
        {
            image: 'icon-button-add-default-view',
            labelKey: 'plusButtonDesc',
        },
        {
            image: 'icon-button-autoplay-default-view',
            labelKey: 'autoplayButtonDesc',
        },
    ],
    icons2: [
        {
            image: 'icon-button-sound-on-default-view',
            labelKey: 'audioButtonOnDesc',
        },
        {
            image: 'icon-button-sound-off-hover-view',
            labelKey: 'audioButtonOffDesc',
        },
        {
            image: 'icon-button-settings-default-view',
            labelKey: 'settingsButtonDesc',
        },
        {
            image: 'icon-button-info-default-view',
            labelKey: 'infoButtonDesc',
        },
    ],
};

export type HowToPlaySectionOptions = Partial<HowToPlaySectionOptionsInternal>;

export class HowToPlaySection extends Container {
    private mainLayout: List;
    private topLayout: List;
    private bottomLayout: List;

    private secondTitleLabel: Label;
    private creditAndBetLabel: Label;

    private infoCards: IconInfoCard[] = [];

    constructor(opts: HowToPlaySectionOptions = {}) {
        super();

        const options: HowToPlaySectionOptionsInternal = {
            icons1: opts.icons1 ?? defaultHowToPlaySectionOptions.icons1,
            icons2: opts.icons2 ?? defaultHowToPlaySectionOptions.icons2,
        };

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 40 });
        this.addChild(this.mainLayout);

        /**
         * TOP ICONS
         */
        this.topLayout = new List({ type: 'vertical', elementsMargin: 20 });

        options.icons1.forEach((icon) => {
            const card = new IconInfoCard({
                image: icon.image,
                label: i18n.t(icon.labelKey),
                imageScale: 0.75,
            });

            this.topLayout.addChild(card);
            this.infoCards.push(card);
        });

        this.mainLayout.addChild(this.topLayout);

        /**
         * SECTION TITLE
         */
        this.secondTitleLabel = new Label(i18n.t('mainGameInterface'), {
            fill: '#FCC100',
        });
        this.mainLayout.addChild(this.secondTitleLabel);

        /**
         * BOTTOM CONTENT
         */
        this.bottomLayout = new List({ type: 'vertical', elementsMargin: 20 });

        this.creditAndBetLabel = new Label(i18n.t('creditsAndBetDesc'), {
            fill: 0xffffff,
            fontSize: 18,
            fontWeight: '200',
            wordWrap: true,
            align: 'center',
        });

        this.bottomLayout.addChild(this.creditAndBetLabel);

        options.icons2.forEach((icon) => {
            const card = new IconInfoCard({
                image: icon.image,
                label: i18n.t(icon.labelKey), // ✅ FIXED: translated at runtime
                imageScale: 1,
            });

            this.bottomLayout.addChild(card);
            card.updateLayout();
            this.infoCards.push(card);
        });

        this.mainLayout.addChild(this.bottomLayout);
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
        for (const card of this.infoCards) {
            card.destroy({ children: true });
        }
        this.infoCards = [];
    }
}
