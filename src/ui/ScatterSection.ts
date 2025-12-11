import { Container } from 'pixi.js';
import { Label } from './Label';
import { List } from '@pixi/ui';
import { PaytableSpecialCard } from './PaytableSpecialCard';

export class ScatterSection extends Container {
    private symbolsDescriptionLabel: Label;
    private mainLayout: List;
    private wildCardContainer: Container;
    private wildCard: PaytableSpecialCard;

    constructor() {
        super();

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 25 });
        this.addChild(this.mainLayout);

        this.symbolsDescriptionLabel = new Label(
            'Hit 4, 5, or 6 SCATTER symbols anywhere on the screen to trigger the FREE SPINS feature and win 15, 20, or 25 free spins respectively.',
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

        this.wildCardContainer = new Container();
        this.wildCard = new PaytableSpecialCard({
            image: 'symbol-10',
            description: 'This is SCATTER symbol. \nSCATTER symbol is present on all reels',
        });
        this.wildCardContainer.addChild(this.wildCard);
        this.mainLayout.addChild(this.wildCardContainer);
    }
    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        if (isMobile && isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 600;

            this.wildCard.fontSize = 28;

            this.mainLayout.y = 140;
        } else if (isMobile && !isPortrait) {
            this.symbolsDescriptionLabel.y = 100;
            this.symbolsDescriptionLabel.style.fontSize = 28;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 1000;

            this.wildCard.fontSize = 28;

            this.mainLayout.y = 80;
        } else {
            this.symbolsDescriptionLabel.y = 60;
            this.symbolsDescriptionLabel.style.fontSize = 18;
            this.symbolsDescriptionLabel.style.wordWrapWidth = 800;

            this.wildCard.fontSize = 18;

            this.mainLayout.y = 60;
        }

        this.symbolsDescriptionLabel.x = width * 0.5;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.elementsMargin = 50;
    }
}
