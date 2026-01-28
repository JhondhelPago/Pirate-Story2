import { Container } from 'pixi.js';
import { Label } from './Label';
import { List } from '@pixi/ui';
import { PaytableSpecialCard } from './PaytableSpecialCard';
import { config } from '../slot/SlotSettings';
import { i18n } from '../i18n/i18n';

const bonusType = config.settings.specialBlocks[0]; //type 11 position at index 0

export class ScatterSection extends Container {
    private symbolsDescriptionLabel: Label;
    private mainLayout: List;
    private bonusCardContainer: Container;
    private bonusCard: PaytableSpecialCard;

    constructor() {
        super();

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 25 });
        this.addChild(this.mainLayout);

        this.symbolsDescriptionLabel = new Label(
            // 'Hit 4, 5, or 6 SCATTER symbols anywhere on the screen to trigger the FREE SPINS feature and win 15, 20, or 25 free spins respectively.',
            i18n.t('scatterDesc'),
            {
                fill: '#ffffff',
                fontSize: 18,
                fontWeight: '200',
                wordWrap: true,
                wordWrapWidth: 800,
                align: 'center',
            },
        );
        this.symbolsDescriptionLabel.anchor.set(0.5);
        this.mainLayout.addChild(this.symbolsDescriptionLabel);

        this.bonusCardContainer = new Container();
        this.bonusCard = new PaytableSpecialCard({
            image: `symbol-${bonusType}`,
            description: `${i18n.t('thisIsScatterSymbol')}. \n${i18n.t('thisIsScatterSymbolDesc')}`,
        });
        this.bonusCardContainer.addChild(this.bonusCard);
        this.mainLayout.addChild(this.bonusCardContainer);
    }
    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        if (isMobile && isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 600;

            this.bonusCard.fontSize = 28;

            this.mainLayout.y = 140;
        } else if (isMobile && !isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 1000;

            this.bonusCard.fontSize = 28;

            this.mainLayout.y = 80;
        } else {
            this.symbolsDescriptionLabel.y = 60;
            this.symbolsDescriptionLabel.style.fontSize = 18;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 800;

            this.bonusCard.fontSize = 18;

            this.mainLayout.y = 60;
        }

        this.symbolsDescriptionLabel.x = width * 0.5;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.elementsMargin = 50;
    }
}
