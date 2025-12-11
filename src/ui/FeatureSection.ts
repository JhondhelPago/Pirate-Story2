import { Container, Sprite } from 'pixi.js';
import { List } from '@pixi/ui';
import { Label } from './Label';
import { Jackpot } from '../slot/SlotConfig';
import { gameConfig } from '../utils/gameConfig';

export class FeatureSection extends Container {
    private descriptionLabel: Label;
    private mainLayout: List;
    private descriptionLabel2: Label;
    private symbolsContainer: List;
    private symbols: Sprite[] = [];
    private jackpots: Jackpot[] = [];

    constructor() {
        super();
        // Grab from game config
        this.jackpots = gameConfig.getJackpots();

        this.mainLayout = new List({ type: 'vertical', elementsMargin: 40 });
        this.addChild(this.mainLayout);

        this.descriptionLabel = new Label(
            'After every spin, winning symbols are paid and removed. Remaining symbols drop down and new ones fall from above to fill the gaps. CASCADE FEATURE continue as long as new wins appear, with no limit to how many can occur. All wins are added after the final cascade.\n\nSpecial award symbols and SCATTER symbols do not disappear and stay on the reels until all cascades from the spin are finished.',
            {
                fill: 0xffffff,
                fontSize: 18,
                fontWeight: '200',
                wordWrap: true, // Enable word wrapping
                align: 'center', // Optional: alignment for the wrapped text
                wordWrapWidth: 1000,
                lineHeight: 24,
            },
        );

        this.mainLayout.addChild(this.descriptionLabel);

        this.symbolsContainer = new List({ type: 'horizontal', elementsMargin: 10 });
        this.mainLayout.addChild(this.symbolsContainer);

        for (const jackpot of this.jackpots.reverse()) {
            const jackpotSprite = Sprite.from(`symbol-${jackpot.type}`);
            jackpotSprite.anchor.y = 0.5;
            jackpotSprite.scale.set(0.5);
            this.symbolsContainer.addChild(jackpotSprite);
            this.symbols.push(jackpotSprite);
        }

        // Center the symbols container after adding all symbols
        this.symbolsContainer.pivot.x = this.symbolsContainer.width / 2;

        this.descriptionLabel2 = new Label(
            'JACKPOT AWARD symbols appear as GRAND, ANGELIC, BLESSED, and DIVINE, each collected during winning spins or cascades toward their respective JACKPOT AWARD meters, awarding the GRAND with 2 symbols, ANGELIC with 3, BLESSED with 4, and DIVINE with 5, with any extra symbols added after the meter resets, and all collected symbols cleared once the spin and its cascades end.',
            {
                fill: 0xffffff,
                fontSize: 18,
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
