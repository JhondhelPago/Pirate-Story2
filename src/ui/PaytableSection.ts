import { Container } from 'pixi.js';
import { Label } from './Label';
import { userSettings } from '../utils/userSettings';
import { Paytable } from '../slot/SlotConfig';
import { List } from '@pixi/ui';
import { gameConfig } from '../utils/gameConfig';
import { PaytableCard } from './PaytableCard';

export class PayTableSection extends Container {
    private symbolsDescriptionLabel: Label;
    private mainLayout: List;
    private betAmount: number;
    private currency: string;
    private paytables: Paytable[];
    private paytableCardsContainer: Container;
    private paytableCards: PaytableCard[] = [];
    private cardsPerRow = 3;
    private cardSpacing = 20;

    constructor() {
        super();

        this.betAmount = userSettings.getBet();
        this.currency = userSettings.getCurrency();
        this.paytables = gameConfig.getPaytables();

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 20 });
        this.addChild(this.mainLayout);

        this.symbolsDescriptionLabel = new Label(
            'Symbols pay regardless of their position. Your payout is based on how many identical symbols appear when the spin ends.',
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

        this.paytableCardsContainer = new Container();

        for (const paytable of this.paytables.slice(0, 9)) {
            const card = new PaytableCard({
                image: `symbol-${paytable.type}`,
                betAmount: this.betAmount,
                currency: this.currency,
                patterns: paytable.patterns,
            });
            this.paytableCardsContainer.addChild(card);
            this.paytableCards.push(card);
        }
        this.layoutCards();
        this.mainLayout.addChild(this.paytableCardsContainer);
    }

    private layoutCards(): void {
        if (this.paytableCards.length === 0) return;

        // Get the dimensions of the first card to use as reference
        const cardWidth = this.paytableCards[0].width;
        const cardHeight = this.paytableCards[0].height;

        // Calculate total grid dimensions
        const totalColumns = Math.min(this.cardsPerRow, this.paytableCards.length);
        const gridWidth = totalColumns * cardWidth + (totalColumns - 1) * this.cardSpacing;

        // Position each card in a grid
        this.paytableCards.forEach((card, index) => {
            const col = index % this.cardsPerRow;
            const row = Math.floor(index / this.cardsPerRow);

            card.x = col * (cardWidth + this.cardSpacing) - gridWidth / 2 + cardWidth / 2;
            card.y = row * (cardHeight + this.cardSpacing);
        });

        // Position the cards container below the description
        this.paytableCardsContainer.y = this.symbolsDescriptionLabel.y + this.symbolsDescriptionLabel.height / 2 + 40;
    }

    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        if (isMobile && isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 600;
            this.cardsPerRow = 3;

            for (const card of this.paytableCards) {
                card.fontSize = 28;
            }

            this.mainLayout.y = 100;
        } else if (isMobile && !isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 1000;
            this.cardsPerRow = 6;

            for (const card of this.paytableCards) {
                card.fontSize = 28;
            }

            this.mainLayout.y = 80;
        } else {
            this.symbolsDescriptionLabel.y = 60;
            this.symbolsDescriptionLabel.style.fontSize = 18;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 800;
            this.cardsPerRow = 6;

            for (const card of this.paytableCards) {
                card.fontSize = 18;
            }

            this.mainLayout.y = 60;
        }

        this.layoutCards();

        this.symbolsDescriptionLabel.x = width * 0.5;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.elementsMargin = 20;
    }
}
