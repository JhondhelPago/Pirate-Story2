import { Container } from 'pixi.js';
import { Label } from './Label';
import { i18n } from '../i18n/i18n';

export class FreeSpinSection extends Container {
    private container: Container;
    private description: Label;

    constructor() {
        super();

        this.container = new Container();
        this.addChild(this.container);

        this.description = new Label(
            i18n.t('freeSpinsDesc'),
            {
                fill: '#ffffff',
                fontSize: 18,
                fontWeight: '200',
                wordWrap: true,
                wordWrapWidth: 800,
                align: 'center',
            },
        );
        this.description.anchor.set(0.5);
        this.container.addChild(this.description);
    }

    public resize(width: number, height: number) {
        const isMobile = document.documentElement.id === 'isMobile';
        const isPortrait = width < height;

        let fontSize: number;
        let wordWrapWidth: number;
        let containerY: number;

        if (isMobile && isPortrait) {
            fontSize = 28;
            wordWrapWidth = 600;
            containerY = 240;
        } else if (isMobile && !isPortrait) {
            fontSize = 28;
            wordWrapWidth = 1000;
            containerY = 160;
        } else {
            fontSize = 18;
            wordWrapWidth = 800;
            containerY = 100;
        }

        // Apply styles
        this.description.style.fontSize = fontSize;
        this.description.style.wordWrapWidth = wordWrapWidth;

        // Center the description within the container
        this.description.x = 0;
        this.description.y = 0;

        // Center the container on screen
        this.container.x = width * 0.5;
        this.container.y = containerY;
    }
}
