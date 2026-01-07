import { Container, Sprite } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { gameConfig } from '../utils/gameConfig';
import { config } from '../utils/userSettings';
import { Block } from '../slot/Match3Config';

const wildType = config.settings.specialBlocks[1]; //type 12 position at index 1

export class FeatureSection extends Container {
    private descriptionLabel: Label;
    private mainLayout: List;
    private descriptionLabel2: Label;
    private symbolsContainer: List;
    private symbols: Sprite[] = [];

    constructor() {
        super();

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 40 });
        this.addChild(this.mainLayout);

        this.descriptionLabel = new Label(
            'After every spin, winning symbols are paid and removed. Remaining symbols drop down and new ones fall from above to fill the gaps. CASCADE FEATURE continue as long as new wins appear, with no limit to how many can occur. All wins are added after the final cascade.\n\nSpecial award symbols and SCATTER symbols do not disappear and stay on the reels until all cascades from the spin are finished.',
            {
                fill: 0xffffff,
                fontSize: 18,
                fontWeight: '200',
                wordWrap: true, 
                align: 'center', 
                wordWrapWidth: 1000,
                lineHeight: 24,
            },
        );

        this.mainLayout.addChild(this.descriptionLabel);

        this.symbolsContainer = new List({ type: 'horizontal', elementsMargin: 10 });
        this.mainLayout.addChild(this.symbolsContainer);

        
        const jackpotSprite = Sprite.from(`symbol-${wildType}`);
        jackpotSprite.anchor.y = 0.5;
        jackpotSprite.scale.set(1);
        this.symbolsContainer.addChild(jackpotSprite);
        this.symbols.push(jackpotSprite);
        

        this.symbolsContainer.pivot.x = this.symbolsContainer.width / 2;

        this.descriptionLabel2 = new Label(
            'This is the WILD symbol and substitute for all symbols except for BONUS. WILD symbol hits with a random multiplier of 2x, 3x, 5x, 10x. Multiplier apply to all wining combination, their mutiplier add to each other. The same WILD can be part of multiple winning combinations.',
            {
                fill: 0xffffff,
                fontSize: 20,
                lineHeight: 24,
                fontWeight: '200',
                wordWrap: true,
                wordWrapWidth: 1000,
                align: 'center',
            },
        );

        this.mainLayout.addChild(this.descriptionLabel2);
    }

    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        if (isMobile && isPortrait) {
            this.descriptionLabel.style.fontSize = 28;
            this.descriptionLabel.style.lineHeight = 34;
            this.descriptionLabel.style.wordWrapWidth = 700;

            for (const symbol of this.symbols) {
                symbol.anchor.y = 1.25;
            }

            this.descriptionLabel2.style.fontSize = 28;
            this.descriptionLabel2.style.lineHeight = 34;
            this.descriptionLabel2.style.wordWrapWidth = 700;

            this.mainLayout.y = 220;
        } else if (isMobile && !isPortrait) {
            this.descriptionLabel.style.fontSize = 28;
            this.descriptionLabel.style.lineHeight = 34;
            this.descriptionLabel.style.wordWrapWidth = 1400;

            for (const symbol of this.symbols) {
                symbol.anchor.y = 0.75;
            }

            this.descriptionLabel2.style.fontSize = 28;
            this.descriptionLabel2.style.lineHeight = 34;
            this.descriptionLabel2.style.wordWrapWidth = 1400;

            this.mainLayout.y = 160;
        } else {
            this.descriptionLabel.style.fontSize = 18;
            this.descriptionLabel.style.lineHeight = 24;
            this.descriptionLabel.style.wordWrapWidth = 1000;

            for (const symbol of this.symbols) {
                symbol.anchor.y = 0.5;
            }

            this.descriptionLabel2.style.fontSize = 18;
            this.descriptionLabel2.style.lineHeight = 24;
            this.descriptionLabel2.style.wordWrapWidth = 1000;

            this.mainLayout.y = 100;
        }

        this.mainLayout.elementsMargin = 50;
        this.mainLayout.x = width * 0.5;
    }
}
