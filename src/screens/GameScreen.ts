import { Container, Ticker } from 'pixi.js';
import { Match3, SlotOnJackpotMatchData, SlotOnJackpotTriggerData } from '../slot/Match3';
import { navigation } from '../utils/navigation';
import { GameEffects } from '../ui/GameEffects';
import { bgm } from '../utils/audio';
import { GameOvertime } from '../ui/GameOvertime';
import { waitFor } from '../utils/asyncUtils';
import { slotGetConfig } from '../slot/Match3Config';
import { GameLogo } from '../ui/GameLogo';
import { BuyFreeSpin } from '../ui/BuyFreeSpin';
// import { RoundResult } from '../ui/RoundResult';
import { ControlPanel } from '../ui/ControlPanel';
import { BetAction, userSettings } from '../utils/userSettings';
import { GoldRoger } from '../ui/GoldRoger';
import { FreeSpinPopup } from '../popups/FreeSpinPopup';
import { FreeSpinWinPopup } from '../popups/FreeSpinWinPopup';
import { JackpotWinPopup } from '../popups/JackpotWinPopup';
import { BarrelBoard } from '../ui/BarrelBoard';
import { InfoPopup, InfoPopupData } from '../popups/InfoPopup';

/** The screen that holds the Match3 game */
export class GameScreen extends Container {
    public static assetBundles = ['game', 'common'];

    public readonly match3: Match3;
    public readonly gameContainer: Container;
    public readonly overtime: GameOvertime;

    public readonly barrelBoard?: BarrelBoard;

    /** The game logo */
    public readonly gameLogo: GameLogo;

    /** The buy free spin button */
    public readonly buyFreeSpin: BuyFreeSpin;

    /** The floating mascot */
    public readonly goldRoger: GoldRoger;

    /** The Control Panel */
    public readonly controlPanel: ControlPanel;

    /** The special effects layer */
    public readonly vfx?: GameEffects;

    /** Track if finish */
    public finished: boolean;

    constructor() {
        super();

        this.gameContainer = new Container();
        this.addChild(this.gameContainer);

        this.barrelBoard = new BarrelBoard('Barrel-Board');
        this.barrelBoard.scale.set(1.2);
        this.gameContainer.addChild(this.barrelBoard);

        this.gameLogo = new GameLogo();
        this.addChild(this.gameLogo);

        this.buyFreeSpin = new BuyFreeSpin();
        this.addChild(this.buyFreeSpin);
        this.buyFreeSpin.show();

        // this.roundResult = new RoundResult();

        this.goldRoger = new GoldRoger();
        this.goldRoger.scale.set(1);
        this.addChild(this.goldRoger);

        /** Match3 core */
        this.match3 = new Match3();
        this.match3.onSpinStart = this.onSpinStart.bind(this);
        // this.match3.onFreeSpinTrigger = this.onFreeSpinTrigger.bind(this);
        this.match3.onFreeSpinStart = this.onFreeSpinStart.bind(this);
        this.match3.onFreeSpinComplete = this.onFreeSpinComplete.bind(this);
        this.match3.onFreeSpinRoundStart = this.onFreeSpinRoundStart.bind(this);
        this.match3.onFreeSpinRoundComplete = this.onFreeSpinRoundComplete.bind(this);
        this.match3.onProcessStart = this.onProcessStart.bind(this);
        this.match3.onProcessComplete = this.onProcessComplete.bind(this);
        this.match3.scale.set(1.2);
        this.gameContainer.addChild(this.match3);

        /** VFX layer */
        this.vfx = new GameEffects(this);
        this.addChild(this.vfx);

        /** Countdown UI */
        this.overtime = new GameOvertime();
        this.addChild(this.overtime);

        /** Control panel */
        this.controlPanel = new ControlPanel();
        this.addChild(this.controlPanel);
        this.controlPanel.setCredit(100000);
        this.controlPanel.setBet(2.0);
        this.controlPanel.setMessage('HOLD SPACE FOR TURBO SPIN');

        this.controlPanel.onSpin(() => this.startSpinning());
        this.controlPanel.onSpacebar(() => this.startSpinning());
        this.controlPanel.onAutoplay(() => {});

        this.controlPanel.onInfo(() => {
            navigation.presentPopup<InfoPopupData>(InfoPopup, {
                finished: this.finished,
                onBetChanged: () => {
                    this.controlPanel.setBet(userSettings.getBet());
                    // this.updateMultiplierAmounts();
                    // this.updateBuyFreeSpinAmount();
                },
            });
        });

        // Bet buttons still work normally
        this.controlPanel.setBet(userSettings.getBet());
        this.controlPanel.onIncreaseBet(() => {
            if (this.finished) return;
            userSettings.setBet(BetAction.INCREASE);
            this.controlPanel.setBet(userSettings.getBet());
        });
        this.controlPanel.onDecreaseBet(() => {
            if (this.finished) return;
            userSettings.setBet(BetAction.DECREASE);
            this.controlPanel.setBet(userSettings.getBet());
        });

        this.finished = false;
        console.log("GameScreen constructed (multiplier system removed)");
    }

    public async startSpinning() {
        if (this.match3.spinning) return;
        await this.match3.spin();
    }


    public freeSpinStartSpinning(spins: number) {
        if (this.finished) return;
        this.finished = true;
        this.match3.freeSpin(spins);
    }

    public prepare() {
        const match3Config = slotGetConfig();
        this.barrelBoard?.setup(match3Config);
        this.match3.setup(match3Config);
    }

    public update(time: Ticker) {
        this.match3.update(time.deltaMS);
    }

    public async pause() {
        this.gameContainer.interactiveChildren = false;
        this.match3.pause();
    }

    public async resume() {
        this.gameContainer.interactiveChildren = true;
        this.match3.resume();
    }

    public reset() {
        this.barrelBoard?.reset();
        this.match3.reset();
    }

    public resize(width: number, height: number) {
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        if (width > height) {
            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.5;

            this.gameLogo.scale.set(.9);
            this.gameLogo.x = 220;
            this.gameLogo.y = this.gameLogo.height * 0.6;

            this.buyFreeSpin.scale.set(1);
            this.buyFreeSpin.x = 220;
            this.buyFreeSpin.y = 480;

            this.goldRoger.x = width - 250;
            this.goldRoger.y = height - 260;

            this.overtime.x = this.gameContainer.x;
            this.overtime.y = this.gameContainer.y;

        } else {
            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.78;

            this.barrelBoard?.scale.set(1.4);
            this.match3.scale.set(1.4);

            this.buyFreeSpin.scale.set(1);
            this.buyFreeSpin.x = 220;
            this.buyFreeSpin.y = height * 0.7;

            this.gameLogo.scale.set(0.87);
            this.gameLogo.x = width * 0.5;
            this.gameLogo.y = 130;

            this.goldRoger.x = width - 160;
            this.goldRoger.y = height - 160;
            this.goldRoger.scale.set(1.2);
        }

        const isMobile = document.documentElement.id === 'isMobile';
        this.controlPanel.resize(width, height, isMobile);
    }

    public async show() {
        bgm.play('common/bgm-game.mp3', { volume: 0.5 });
        this.match3.startPlaying();
    }

    public async hide() {
        this.overtime.hide();
        this.vfx?.playGridExplosion();
        await waitFor(0.3);
    }

    // private async onFreeSpinTrigger(): Promise<void> {
    //     return new Promise((resolve) => {
    //         navigation.presentPopup(FreeSpinPopup, async () => {
    //             await navigation.dismissPopup();
    //             await waitFor(1);
    //             this.match3.actions.actionFreeSpin();
    //             resolve();
    //         });
    //     });
    // }

    private async onSpinStart() {
        console.log('SPIN STARTED');
        // Multiplier reset removed
    }

    private async onFreeSpinStart() {
        console.log('FREE SPIN PROCESS STARTING');
    }

    private async onFreeSpinComplete() {
        // return new Promise((resolve) => {
        //     navigation.presentPopup(FreeSpinWinPopup, {
        //         winAmount: 1000,
        //         spinsCount: 3,
        //         callBack: async () => {
        //             await navigation.dismissPopup();
        //             await waitFor(1);
        //             if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing())
        //                 this.finish();
        //             resolve;
        //         },
        //     });
        // });
    }

    private async onFreeSpinRoundStart() {
        console.log('FREE SPIN ROUND STARTING');
    }

    private async onFreeSpinRoundComplete() {
        console.log('FREE SPIN ROUND COMPLETE');
    }

    private onProcessStart() {
        console.log('PROCESS STARTING');
    }

    private onProcessComplete() {
        if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing())
            this.finish();
        this.finished = false;
    }

    private async finish() {
        if (!this.finished) return;
        this.finished = false;
    }
}
