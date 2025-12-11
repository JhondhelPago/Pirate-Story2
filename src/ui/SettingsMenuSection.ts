import { Container } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { IconInfoCard } from './IconInfoCard';

const defaultSettingsMenuSectionOptions = {
    icons1: [
        {
            label: 'QUICK SPIN - Selects the Quick Spin for game reels to start automatucally stop as soon as released.',
        },
        {
            label: 'AMBIENT MUSIC - toggles the ambient sound and music in the game ON and OFF',
        },
        {
            label: 'SOUND FX - toggles the game sound effects ON and OFF',
        },
    ],
    icons2: [
        {
            image: 'icon-button-left-arrow-default-view',
            label: 'Back navigation between information sections',
        },
        {
            image: 'icon-button-right-arrow-default-view',
            label: 'Next navigation between information sections',
        },
        {
            image: 'icon-button-default-close-view',
            label: 'Close information screen',
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

        this.secondTitleLabel = new Label('Main Game Interface', {
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
