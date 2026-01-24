import { Container, FillGradient, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { i18n } from '../i18n/i18n';
import { IconButton } from '../ui/IconButton';
import { bgm, sfx } from '../utils/audio';
import { navigation } from '../utils/navigation';
import { PreviewScreen } from './PreviewScreen';
import { GameLogo } from '../ui/GameLogo';

/** Screen shown while loading assets */
export class LoadScreen extends Container {
    /** Assets bundles required by this screen */
    public static assetBundles = ['preload'];
    /** LThe loading message display */
    private message: Text;
    /** The logo */
    private logo: GameLogo;
    /** Yes Button */
    private yesButton: IconButton;
    /** No button */
    private noButton: IconButton;

    constructor() {
        super();

        this.yesButton = new IconButton({
            icon: 'confirm-button',
            width: 80,
            height: 80,
            backgroundColor: 0x4a90e2, // Blue
            hoverColor: 0x5aa3f5, // Lighter blue
            pressColor: 0x3a7bc8, // Darker blue
        });
        this.yesButton.scale.set(1.5);
        this.addChild(this.yesButton);
        this.yesButton.onPress.connect(() => {
            bgm.setVolume(1);
            sfx.setVolume(1);
            navigation.showScreen(PreviewScreen);
        });

        this.noButton = new IconButton({
            icon: 'cancel-button',
            width: 80,
            height: 80,
            backgroundColor: 0x4a90e2, // Blue
            hoverColor: 0x5aa3f5, // Lighter blue
            pressColor: 0x3a7bc8, // Darker blue
        });
        this.noButton.scale.set(1.5);
        this.addChild(this.noButton);
        this.noButton.onPress.connect(() => {
            sfx.setVolume(0);
            bgm.setVolume(0);
            navigation.showScreen(PreviewScreen);
        });

        const verticalGradient1 = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#FBF0D3' },
                { offset: 1, color: '#F4DFB7' },
            ],
            textureSpace: 'local',
        });

        this.message = new Text({
            text: i18n.t('doYouWantToPlayWithSound'),
            style: {
                fill: verticalGradient1,
                fontFamily: 'Spartanmb Extra Bold',
                align: 'center',
                fontSize: 52,
                stroke: {
                    width: 6,
                    color: '#6D3000',
                },
            },
        });
        this.message.anchor.set(0.5);
        this.addChild(this.message);

        this.logo = new GameLogo();
        this.logo.scale.set(0.5);
        this.addChild(this.logo);
    }

    /** Resize the screen, fired whenever window size changes  */
    public resize(width: number, height: number) {
        if (width > height) {
            this.message.x = width * 0.5;
            this.message.y = height * 0.65;

            this.logo.x = width * 0.5;
            this.logo.y = height * 0.35;

            this.yesButton.x = width * 0.5 - 200;
            this.yesButton.y = height * 0.8;

            this.noButton.x = width * 0.5 + 200;
            this.noButton.y = height * 0.8;
        } else {
            this.message.x = width * 0.5;
            this.message.y = height * 0.55;

            this.logo.x = width * 0.5;
            this.logo.y = height * 0.35;

            this.yesButton.x = width * 0.5 - 150;
            this.yesButton.y = height * 0.75;

            this.noButton.x = width * 0.5 + 150;
            this.noButton.y = height * 0.75;
        }
    }

    /** Show screen with animations */
    public async show() {
        gsap.killTweensOf(this.message);
        this.message.alpha = 1;
    }

    /** Hide screen with animations */
    public async hide() {
        // Change then hide the loading message
        this.message.text = 'We’re Ready!';
        gsap.killTweensOf(this.message);
        gsap.to(this.message, {
            alpha: 0,
            duration: 0.3,
            ease: 'linear',
            delay: 0.5,
        });
    }
}
