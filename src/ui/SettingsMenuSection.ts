import { Container } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { IconInfoCard } from './IconInfoCard';
import { i18n } from '../i18n/i18n';
import type { I18nKey } from '../i18n/i18n';

/**
 * Types
 */
type TextOption = {
    labelKey: I18nKey;
};

type IconOption = {
    image: string;
    labelKey: I18nKey;
};

type SettingsMenuSectionOptionsInternal = {
    icons1: TextOption[];
    icons2: IconOption[];
};

/**
 * Defaults (store KEYS only)
 */
const defaultSettingsMenuSectionOptions: SettingsMenuSectionOptionsInternal = {
    icons1: [
        { labelKey: 'quickSpinDesc' },
        { labelKey: 'ambientMusicDesc' },
        { labelKey: 'soundFXDesc' },
    ],
    icons2: [
        {
            image: 'icon-button-left-arrow-default-view',
            labelKey: 'backButtonDesc',
        },
        {
            image: 'icon-button-right-arrow-default-view',
            labelKey: 'nextButtonDesc',
        },
        {
            image: 'icon-button-default-close-view',
            labelKey: 'closeButtonDesc',
        },
    ],
};

export type SettingsMenuSectionOptions = Partial<SettingsMenuSectionOptionsInternal>;

export class SettingsMenuSection extends Container {
    private mainLayout: List;

    private topLayout: List;
    private bottomLayout: List;

    private secondTitleLabel: Label;
    private infoCards: IconInfoCard[] = [];
    private labels: Label[] = [];

    constructor(opts: SettingsMenuSectionOptions = {}) {
        super();

        const options: SettingsMenuSectionOptionsInternal = {
            icons1: opts.icons1 ?? defaultSettingsMenuSectionOptions.icons1,
            icons2: opts.icons2 ?? defaultSettingsMenuSectionOptions.icons2,
        };

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 50 });
        this.addChild(this.mainLayout);

        /**
         * TOP TEXT LABELS
         */
        this.topLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.mainLayout.addChild(this.topLayout);

        options.icons1.forEach((item) => {
            const label = new Label(i18n.t(item.labelKey), {
                fill: 0xffffff,
                fontSize: 18,
                fontWeight: '200',
                wordWrap: true,
                wordWrapWidth: 800,
                align: 'center',
            });

            this.topLayout.addChild(label);
            this.labels.push(label);
        });

        /**
         * SECTION TITLE
         */
        this.secondTitleLabel = new Label(i18n.t('mainGameInterface'), {
            fill: '#FCC100',
        });
        this.secondTitleLabel.anchor.set(0.5);
        this.mainLayout.addChild(this.secondTitleLabel);

        /**
         * BOTTOM ICON CARDS
         */
        this.bottomLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.mainLayout.addChild(this.bottomLayout);

        options.icons2.forEach((icon) => {
            const card = new IconInfoCard({
                image: icon.image,
                label: i18n.t(icon.labelKey),
                imageScale: 0.75,
            });

            this.bottomLayout.addChild(card);
            this.infoCards.push(card);
        });
    }

    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        if (isMobile && isPortrait) {
            this.secondTitleLabel.style.fontSize = 36;

            for (const label of this.labels) {
                label.style.fontSize = 28;
                label.style.wordWrapWidth = 800;
            }

            for (const card of this.infoCards) {
                card.text.style.fontSize = 28;
                card.text.style.wordWrapWidth = 800;
                card.updateLayout();
            }
        } else if (isMobile && !isPortrait) {
            this.secondTitleLabel.style.fontSize = 36;

            for (const label of this.labels) {
                label.style.fontSize = 28;
                label.style.wordWrapWidth = 1200;
            }

            for (const card of this.infoCards) {
                card.text.style.fontSize = 28;
                card.text.style.wordWrapWidth = 1200;
                card.updateLayout();
            }
        } else {
            this.secondTitleLabel.style.fontSize = 28;

            for (const label of this.labels) {
                label.style.fontSize = 18;
                label.style.wordWrapWidth = 1000;
            }

            for (const card of this.infoCards) {
                card.text.style.fontSize = 18;
                card.text.style.wordWrapWidth = 1000;
                card.updateLayout();
            }
        }

        this.topLayout.elementsMargin = 20;
        this.bottomLayout.elementsMargin = 20;
        this.mainLayout.elementsMargin = 50;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.y = 80;
    }

    public async hide() {
        for (const label of this.labels) {
            label.destroy();
        }
        this.labels = [];

        for (const card of this.infoCards) {
            card.destroy({ children: true });
        }
        this.infoCards = [];
    }
}
