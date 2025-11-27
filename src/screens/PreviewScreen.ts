import { Container, FillGradient, Text } from 'pixi.js';
import gsap from 'gsap';
import { i18n } from '../utils/i18n';
import { SlotPreview } from '../slot/preview/SlotPreview';
import { slotGetConfig } from '../slot/Match3Config';
import { Pillar } from '../ui/Pillar';
import { PlayButton } from '../ui/PlayButton';
import { navigation } from '../utils/navigation';
import { GameScreen } from './GameScreen';
import { GameLogo } from '../ui/GameLogo';
import { MessagePagination } from '../ui/MessagePagination';
import { BarrelBoard } from '../ui/BarrelBoard';

/** Screen shown while loading assets */
export class PreviewScreen extends Container {
    /** Assets bundles required by this screen */
    public static assetBundles = ['preload', 'preview', 'game'];
    /** Messages text */
    private messageList: string[];
    /** The loading message display */
    private message: Text;
    /** Message pagination component */
    private messagePagination: MessagePagination;
    /** Auto-rotate interval */
    private messageRotateInterval?: NodeJS.Timeout;

    /** Game Preview */
    private slotPreview: SlotPreview;
    /** Game Frame */
    private barrelBoard: BarrelBoard;
    /** Play button */
    private playButton: PlayButton;
    /** The game logo */
    public readonly gameLogo: GameLogo;

    constructor() {
        super();

        this.barrelBoard = new BarrelBoard('Barrel-Board');
        this.barrelBoard.scale.set(0.8);
        this.addChild(this.barrelBoard);

        this.slotPreview = new SlotPreview();
        this.slotPreview.scale.set(0.8);
        this.addChild(this.slotPreview);

        const verticalGradient1 = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
            colorStops: [
                { offset: 0, color: '#FDD44F' },
                { offset: 1, color: '#FF7700' },
            ],
            textureSpace: 'local',
        });

        this.message = new Text({
            text: 'Win up to 250x bet',
            style: {
                fill: verticalGradient1,
                fontFamily: 'Spartanmb Extra Bold',
                fontSize: 40,
                stroke: {
                    width: 6,
                    color: '#6D3000',
                },
                align: 'center',
            },
        });
        this.message.anchor.set(0.5);
        this.addChild(this.message);

        this.playButton = new PlayButton();
        this.addChild(this.playButton);
        this.playButton.onClick(() => navigation.showScreen(GameScreen));

        this.gameLogo = new GameLogo();
        // this.gameLogo.scale.set(2);
        this.addChild(this.gameLogo);

        this.messageList = ['Win up to 250x bet', 'Jackpot chance increased!', 'Big Wins are coming!'];

        // Create pagination component
        this.messagePagination = new MessagePagination(this.messageList.length, 80);
        this.messagePagination.setOnPageChange((index) => {
            this.showMessage(index);
            this.resetMessageRotation();
        });
        this.addChild(this.messagePagination);

        // Start auto-rotating messages
        this.startMessageRotation();
    }

    /** Show specific message by index */
    private showMessage(index: number) {
        // Fade out current message
        gsap.to(this.message, {
            alpha: 0,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: () => {
                // Change text
                this.message.text = this.messageList[index];

                // Fade in new message
                gsap.to(this.message, {
                    alpha: 1,
                    duration: 0.3,
                    ease: 'power2.in',
                });
            },
        });
    }

    /** Start auto-rotating messages every 3 seconds */
    private startMessageRotation() {
        this.messageRotateInterval = setInterval(() => {
            this.messagePagination.nextPage();
        }, 3000);
    }

    /** Reset the message rotation timer */
    private resetMessageRotation() {
        if (this.messageRotateInterval) {
            clearInterval(this.messageRotateInterval);
        }
        this.startMessageRotation();
    }

    /** Stop message rotation (call when screen is hidden) */
    private stopMessageRotation() {
        if (this.messageRotateInterval) {
            clearInterval(this.messageRotateInterval);
            this.messageRotateInterval = undefined;
        }
    }

    /** Resize the screen, fired whenever window size changes  */
    public resize(width: number, height: number) {
        if (width > height) {
            this.message.x = width * 0.35;
            this.message.y = height * 0.85;

            this.slotPreview.x = width * 0.35;
            this.slotPreview.y = height * 0.4;

            this.barrelBoard.x = width * 0.35;
            this.barrelBoard.y = height * 0.4;

            this.playButton.x = width * 0.8;
            this.playButton.y = height * 0.75;

            this.gameLogo.x = width * 0.8;
            this.gameLogo.y = height * 0.25;

            // Position pagination below message
            this.messagePagination.x = width * 0.35;
            this.messagePagination.y = height * 0.92;
        } else {
            this.message.x = width * 0.5;
            this.message.y = height * 0.7;

            this.slotPreview.x = width * 0.5;
            this.slotPreview.y = height * 0.45;

            this.barrelBoard.x = width * 0.5;
            this.barrelBoard.y = height * 0.45;

            this.playButton.x = width * 0.5;
            this.playButton.y = height * 0.85;

            this.gameLogo.x = width * 0.5;
            this.gameLogo.y = height * 0.1;

            // Position pagination below message
            this.messagePagination.x = width * 0.5;
            this.messagePagination.y = height * 0.75;
        }
    }

    /** Show screen with animations */
    public async show() {
        gsap.killTweensOf(this.message);
        this.message.alpha = 1;
        this.startMessageRotation();
    }

    /** Prepare the screen just before showing */
    public prepare() {
        const match3Config = slotGetConfig();
        this.slotPreview.setup(match3Config);
        this.barrelBoard.setup(match3Config);
    }

    /** Hide screen with animations */
    public async hide() {
        // Stop message rotation
        this.stopMessageRotation();

        // Change then hide the loading message
        this.message.text = i18n.loadingDone;
        gsap.killTweensOf(this.message);
        gsap.to(this.message, {
            alpha: 0,
            duration: 0.3,
            ease: 'linear',
            delay: 0.5,
        });
    }
}
