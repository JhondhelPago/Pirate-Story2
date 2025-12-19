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
import { BarrelBoard } from '../ui/BarrelBoard';
import { InfoPopup, InfoPopupData } from '../popups/InfoPopup';
import { SpinRoundBanner } from '../popups/SpinRoundBanner';
import { RoundResult } from '../slot/SlotUtility';
import { SettingsPopup } from '../popups/SettingsPopup';
import { gameConfig } from '../utils/gameConfig';
import { TotalWinBanner } from '../popups/TotalWinBanner';
import { FreeSpinWinBanner } from '../popups/FreeSpinWinBanner';

export type SettingsPopupData = {
    finished: boolean;
    onBetSettingChanged: () => void;
    onAudioSettingChanged: (isOn: boolean) => void;
};

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
        this.controlPanel.setCredit(200000);
        this.controlPanel.setBet(2.0);
        this.controlPanel.setMessage('HOLD SPACE FOR TURBO SPIN');

        this.controlPanel.onSpin(() => this.startSpinning());
        this.controlPanel.onSpacebar(() => this.startSpinning());
        this.controlPanel.onAutoplay(() => {});

        this.controlPanel.onSettings(() => {
            navigation.presentPopup<SettingsPopupData>(SettingsPopup, {
                finished: this.finished,
                onBetSettingChanged: () => {
                    this.controlPanel.setBet(userSettings.getBet());
                    
                    // function to be resolved
                    // this.updateMultiplierAmounts();
                    // this.updateBuyFreeSpinAmount();
                },
                onAudioSettingChanged: (isOn: boolean) => {
                    this.controlPanel.audioButton.setToggleState(isOn);
                },
            });
        });

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
    }

    public async startSpinning() {
        if (this.match3.spinning) return;
        await this.match3.spin();
    }


    public freeSpinStartSpinning(spins: number) {
        // call back here to trigger the Match3FreSpinProcess
        if (this.finished) return;
        this.match3.freeSpin(spins);
        this.finished = true;
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

    private async onSpinStart() {
        console.log('SPIN STARTED');
        // Multiplier reset removed

        this.controlPanel.disableBetting();

    }

    private async onFreeSpinStart() {
        console.log('FREE SPIN PROCESS STARTING');
        // call the Match3FreeSpinProcess to Start the buy ree spin rounds
    }

    private async onFreeSpinComplete(current: number, remaining:number) { // spins complete trigger
        // show the total win banner with the amount won, 
        console.log(`Total Won in ${current} Free Spin: `, this.match3.freeSpinProcess.getAccumulatedWin());
        console.log("navigation pop for the total won banner");
        navigation.presentPopup(TotalWinBanner, {win: this.match3.freeSpinProcess.getAccumulatedWin()});
        //navigation.presentPopup(FreeSpinWinBanner, {spins: 10});

    }
    
    private async onFreeSpinRoundStart(current: number, remaining: number) {
        console.log("Current Spin: ", current, "Remaining Spins: ", remaining);
        this.controlPanel.setMessage(`FREE SPIN LEFT ${remaining}`);
        
        this.controlPanel.disableBetting();
    }
    
    private async onFreeSpinRoundComplete() { // spin round complete trigger for buy free spin feature
        console.log("onFreeSpinRoundComplete trigger uysing the freespinprocess");
        const TotalWon = this.match3.freeSpinProcess.getAccumulatedWin();
        // change this to display the accumulated win
        if (TotalWon > 0){
            this.controlPanel.setTitle(`Win ${TotalWon}`);    
        } else {
            this.controlPanel.setTitle(`GOOD LUCK`);
        }

        this.messageMatchQueuing(this.match3.process.getRoundResult());
        // when both processes are not processing (end of a round)
        if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing()) {
            await this.finish();
            await this.drawWinBannerAsync(this.match3.process.getRoundWin()); // ✅ wait banner close
        }

        this.controlPanel.enableBetting();
        this.finished = false;

    }

    private onProcessStart() {
        console.log('ON PROCESS START');
    }

    private async onProcessComplete() {
        const roundWin = this.match3.process.getRoundWin()

        if (roundWin > 0){
            this.controlPanel.setTitle(`Win ${this.match3.process.getRoundWin()}`);    
        } else {
            this.controlPanel.setTitle(`GOOD LUCK`);
        }

        this.messageMatchQueuing(this.match3.process.getRoundResult());

        // when both processes are not processing (end of a round)
        if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing()) {
            await this.finish();
            await this.drawWinBannerAsync(this.match3.process.getRoundWin()); // ✅ wait banner close
        }

        this.controlPanel.enableBetting();
        this.finished = false;
    }


    private async finish() {
        if (!this.finished) return;
        this.finished = false;
    }

    private async drawWinBannerAsync(winAmount: number): Promise<void> {
        if (winAmount < 50) return;

        await waitFor(2);
        await new Promise<void>((resolve) => {
            navigation.presentPopup(SpinRoundBanner, {
                win: winAmount,
                onClosed: resolve, // ✅ resolves when SpinRoundBanner.hide() finishes
            });
        });
    }


    private drawTotalWinBanner(winAmount: number){
        // navigationPresentPopu() calling the TotalWinBanner and passing th3e total win amount
    }

    private messageMatchQueuing(roundResult: RoundResult) {
        roundResult.map(r => {
            this.controlPanel.addMatchMessage(r.multiplier, r.type, userSettings.getBet() * r.multiplier, 'krw');
        });

        this.controlPanel.playMatchMessages();
    }
}
