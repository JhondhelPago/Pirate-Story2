import { Container, FillGradient, Text } from 'pixi.js';
import gsap from 'gsap';
import { i18n } from '../utils/i18n';
import { SlotPreview } from '../slot/preview/SlotPreview';
import { slotGetConfig } from '../slot/Match3Config';
import { PlayButton } from '../ui/PlayButton';
import { navigation } from '../utils/navigation';
import { GameScreen } from './GameScreen';
import { GameLogo } from '../ui/GameLogo';
import { MessagePagination } from '../ui/MessagePagination';
import { BarrelBoard } from '../ui/BarrelBoard';
import { GoldRoger } from '../ui/GoldRoger';
import { bgm } from '../utils/audio';

/** Screen shown while loading assets */
export class PreviewScreen extends Container {
    public static assetBundles = ['preload', 'preview', 'game'];

    private messageList: string[];
    private message: Text;
    private messagePagination: MessagePagination;
    private messageRotateInterval?: NodeJS.Timeout;

    private slotPreview: SlotPreview;
    private barrelBoard: BarrelBoard;
    private playButton: PlayButton;
    private goldRoger: GoldRoger;

    public readonly gameLogo: GameLogo;

    constructor() {
        super();

        this.barrelBoard = new BarrelBoard('Barrel-Board');
        this.barrelBoard.scale.set(0.8);
        this.addChild(this.barrelBoard);

        this.slotPreview = new SlotPreview();
        this.slotPreview.scale.set(0.85);
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
                stroke: { width: 6, color: '#6D3000' },
                align: 'center',
            },
        });
        this.message.anchor.set(0.5);
        this.addChild(this.message);

        this.goldRoger = new GoldRoger();
        this.addChild(this.goldRoger);

        this.playButton = new PlayButton();
        this.playButton.scale.set(.9);
        this.addChild(this.playButton);
        this.playButton.onClick(() => navigation.showScreen(GameScreen));

        this.gameLogo = new GameLogo();
        this.addChild(this.gameLogo);

        this.messageList = ['Win up to 250x bet', 'Jackpot chance increased!', 'Big Wins are coming!'];

        this.messagePagination = new MessagePagination(this.messageList.length, 80);
        this.messagePagination.setOnPageChange((index) => {
            this.showMessage(index);
            this.resetMessageRotation();
        });
        this.addChild(this.messagePagination);

        this.startMessageRotation();
    }

    private showMessage(index: number) {
        gsap.to(this.message, {
            alpha: 0,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: () => {
                this.message.text = this.messageList[index];
                gsap.to(this.message, {
                    alpha: 1,
                    duration: 0.3,
                    ease: 'power2.in',
                });
            },
        });
    }

    private startMessageRotation() {
        this.messageRotateInterval = setInterval(() => {
            this.messagePagination.nextPage();
        }, 3000);
    }

    private resetMessageRotation() {
        if (this.messageRotateInterval) clearInterval(this.messageRotateInterval);
        this.startMessageRotation();
    }

    private stopMessageRotation() {
        if (this.messageRotateInterval) {
            clearInterval(this.messageRotateInterval);
            this.messageRotateInterval = undefined;
        }
    }

    /** RESIZE WITH IMPROVED MOBILE LAYOUT */
    public resize(width: number, height: number) {
    const isMobile = width < height;

    if (!isMobile) {
        // ---------- DESKTOP LANDSCAPE ----------
        this.goldRoger.visible = false;

        // FIX: Reduce preview size for desktop
        this.slotPreview.scale.set(0.8);
        this.slotPreview.x = width * 0.35;
        this.slotPreview.y = height * 0.35;

        this.barrelBoard.scale.set(0.8);
        this.barrelBoard.x = width * 0.35;
        this.barrelBoard.y = height * 0.35;
        
        this.playButton.x = width * 0.82;
        this.playButton.y = height * 0.6;
        
        this.gameLogo.scale.set(.85);
        this.gameLogo.x = width * 0.82;
        this.gameLogo.y = height * 0.2;
        
        this.message.x = width * 0.35;
        this.message.y = this.barrelBoard.y + 350;

        this.messagePagination.x = width * 0.35;
        this.messagePagination.y = this.message.y + 70;
        return;
    }

    // ---------- MOBILE PORTRAIT ----------
    this.goldRoger.visible = true;

    // FIX: Increase preview size for mobile
    this.slotPreview.scale.set(0.85);

    this.slotPreview.x = width * 0.5;
    this.slotPreview.y = height * 0.34;

    this.barrelBoard.scale.set(0.85);
    this.barrelBoard.x = width * 0.5;
    this.barrelBoard.y = height * 0.34;

    this.message.scale.set(1.5)
    this.message.x = width * 0.5;
    this.message.y = height * .55;

    this.playButton.scale.set(1.4)
    this.playButton.x = width * 0.5;
    this.playButton.y = height * 0.80;

    this.goldRoger.x = width * 0.85;
    this.goldRoger.y = height * 0.80;

    this.gameLogo.x = width * 0.5;
    this.gameLogo.y = height * 0.10;

    this.messagePagination.x = width * 0.5;
    this.messagePagination.y = this.message.y + 150;
}

    public async show() {
        bgm.play('common/bgm-main.mp3', { volume: 0.3 });

        gsap.killTweensOf(this.message);
        this.message.alpha = 1;
        this.startMessageRotation();
    }

    public prepare() {
        const match3Config = slotGetConfig();
        this.slotPreview.setup(match3Config);
        this.barrelBoard.setup(match3Config);
    }

    public async hide() {
        this.stopMessageRotation();
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
