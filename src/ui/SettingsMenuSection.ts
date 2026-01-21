import { Container } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { IconInfoCard } from './IconInfoCard';
import { i18n } from '../i18n/i18n';

const defaultSettingsMenuSectionOptions = {
    icons1: [
        {
            label: i18n.t('quickSpinDesc'),
        },
        {
            label: i18n.t('ambientMusicDesc'),
        },
        {
            label: i18n.t('soundFXDesc'),
        },
    ],
    icons2: [
        {
            image: 'icon-button-left-arrow-default-view',
            label: i18n.t('backButtonDesc'),
        },
        {
            image: 'icon-button-right-arrow-default-view',
            label: i18n.t('nextButtonDesc'),
        },
        {
            image: 'icon-button-default-close-view',
            label: i18n.t('closeButtonDesc'),
        },
    ],
};

export type SettingsMenuSectionOptions = typeof defaultSettingsMenuSectionOptions;
export class SettingsMenuSection extends Container {
    private mainLayout: List;

    private topLayout: List;
    private bottomLayout: List;

    private secondTitleLabel: Label;
    private infoCards: IconInfoCard[] = [];
    private labels: Label[] = [];

    constructor(opts: Partial<SettingsMenuSectionOptions> = {}) {
        super();

        const options = { ...defaultSettingsMenuSectionOptions, ...opts };

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 50 });
        this.addChild(this.mainLayout);

        this.topLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.mainLayout.addChild(this.topLayout);

        options.icons1?.forEach((icon) => {
            const label = new Label(icon.label, {
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

        this.secondTitleLabel = new Label(i18n.t('mainGameInterface'), {
            fill: '#FCC100',
        });
        this.secondTitleLabel.anchor.set(0.5);
        this.mainLayout.addChild(this.secondTitleLabel);

        this.bottomLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.mainLayout.addChild(this.bottomLayout);

        options.icons2.forEach((icon) => {
            const card = new IconInfoCard({ image: icon.image, label: icon.label, imageScale: 0.75 });
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
        // Clean up labels
        for (const label of this.labels) {
            label.destroy();
        }
        this.labels = [];

        // Clean up info cards
        for (const card of this.infoCards) {
            card.destroy({ children: true });
        }
        this.infoCards = [];
    }
}
