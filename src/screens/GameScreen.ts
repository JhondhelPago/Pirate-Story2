import { Container, Ticker } from 'pixi.js';
import { Match3 } from '../slot/Match3';
import { navigation } from '../utils/navigation';
import { GameEffects } from '../ui/GameEffects';
import { bgm } from '../utils/audio';
import { GameOvertime } from '../ui/GameOvertime';
import { waitFor } from '../utils/asyncUtils';
import { slotGetConfig } from '../slot/Match3Config';
import { GameLogo } from '../ui/GameLogo';
import { BuyFreeSpin } from '../ui/BuyFreeSpin';
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
import { AutoplayPopup, AutoplayPopupData } from '../popups/AutoplayPopup';

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
        this.buyFreeSpin.show(); // visible always

        this.goldRoger = new GoldRoger();
        this.goldRoger.scale.set(1);
        this.addChild(this.goldRoger);

        /** Match3 core */
        this.match3 = new Match3();
        this.match3.onSpinStart = this.onSpinStart.bind(this);
        this.match3.onFreeSpinStart = this.onFreeSpinStart.bind(this);
        this.match3.onFreeSpinComplete = this.onFreeSpinComplete.bind(this);
        this.match3.onFreeSpinRoundStart = this.onFreeSpinRoundStart.bind(this);
        this.match3.onFreeSpinRoundComplete = this.onFreeSpinRoundComplete.bind(this);

        // this.match3.onAutoSpinStart = this.onAutoSpinStart.bind(this);
        // this.match3.onAutoSpinComplete = this.onAutoSpinComplete.bind(this);
        // this.match3.onAutoSpinRoundStart = this.onAutoSpinRoundStart.bind(this);
        // this.match3.onAutoSpinRoundComplete = this.onAutoSpinRoundComplete.bind(this);

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
        this.controlPanel.onAutoplay(() => {
            const spinMode = 'normal-spin';
            navigation.presentPopup<AutoplayPopupData>(AutoplayPopup, {
                    spinMode,
                    callback: async (spins: number) => {
                        if (this.finished) return;
                        await navigation.dismissPopup();
                        console.log("AutoPlay Initiated here.");
                        //  GameScreen function here to trigger the auto spin
                        this.autoSpinStartSpinning(5);
                    },
                });
        });

        this.controlPanel.onSettings(() => {
            navigation.presentPopup<SettingsPopupData>(SettingsPopup, {
                finished: this.finished,
                onBetSettingChanged: () => {
                    this.controlPanel.setBet(userSettings.getBet());
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

        // ✅ initial sync
        this.syncFeatureAvailability();
    }

    /** Busy flags based on your exact getters */
    private getNormalProcessing(): boolean {
        return this.match3.process?.isProcessing?.() ?? false;
    }

    private getFreeSpinProcessing(): boolean {
        // ✅ per your note: freeSpinProcess.getFreeSpinProcessing()
        return this.match3.freeSpinProcess?.getFreeSpinProcessing?.() ?? false;
    }

    private getAutoSpinProcessing(): boolean {
        return this.match3.autoSpinProcess?.getAutoSpinProcessing?.() ?? false;
    }

    /**
     * ✅ BuyFreeSpin stays VISIBLE but is DISABLED while:
     * - normal process is processing
     * - OR free spin process is processing
     *
     * ✅ Spin/betting disabled while either processing is active
     */
    private syncFeatureAvailability() {
        const normalProcessing = this.getNormalProcessing();
        const freeSpinProcessing = this.getFreeSpinProcessing();

        const canInteract = !normalProcessing && !freeSpinProcessing;

        // BuyFreeSpin: visible always, enabled only when idle
        this.buyFreeSpin.setEnabled(canInteract);

        // Spin/Betting
        if (canInteract) this.controlPanel.enableBetting();
        else this.controlPanel.disableBetting();
    }

    /** Hard lock (used while waiting 2s + while popup is showing) */
    private lockInteraction() {
        this.buyFreeSpin.setEnabled(false);
        this.controlPanel.disableBetting();
    }

    public async startSpinning() {
        if (this.match3.spinning) return;
        // if (this.getNormalProcessing() || this.getFreeSpinProcessing()) return;
        if (this.getNormalProcessing() || this.getFreeSpinProcessing() || this.getAutoSpinProcessing()) return;

        this.lockInteraction();
        await this.match3.spin();
    }

    public freeSpinStartSpinning(spins: number) {
        if (this.finished) return;
        // if (this.getNormalProcessing() || this.getFreeSpinProcessing()) return;
        if (this.getNormalProcessing() || this.getFreeSpinProcessing() || this.getAutoSpinProcessing()) return;

        this.lockInteraction();
        this.match3.freeSpin(spins);
        this.finished = true;
    }

    public autoSpinStartSpinning(spins: number) {
        if (this.finished) return;
        if (this.getNormalProcessing() || this.getFreeSpinProcessing() || this.getAutoSpinProcessing()) return;

        this.lockInteraction();
        this.match3.autoSpin(spins);
        this.finished = true;
    }

    public prepare() {
        const match3Config = slotGetConfig();
        this.barrelBoard?.setup(match3Config);
        this.match3.setup(match3Config);
        this.syncFeatureAvailability();
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
        this.syncFeatureAvailability();
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
        this.syncFeatureAvailability();
    }

    public async hide() {
        this.overtime.hide();
        this.vfx?.playGridExplosion();
        await waitFor(0.3);
    }

    private async onSpinStart() {
        console.log('SPIN STARTED');
        this.lockInteraction();
    }

    private async onFreeSpinStart() {
        console.log('FREE SPIN PROCESS STARTING');
        this.lockInteraction();
    }

    private async onFreeSpinComplete(current: number, remaining: number) {
        console.log(`Total Won in ${current} Free Spin: `, this.match3.freeSpinProcess.getAccumulatedWin());
        this.drawTotalWinBanner(this.match3.freeSpinProcess.getAccumulatedWin());
        this.syncFeatureAvailability();
    }

    private async onFreeSpinRoundStart(current: number, remaining: number) {
        console.log("Current Spin: ", current, "Remaining Spins: ", remaining);
        this.controlPanel.setMessage(`FREE SPIN LEFT ${remaining}`);
        this.lockInteraction();
    }

    private async onFreeSpinRoundComplete() {
        console.log("onFreeSpinRoundComplete trigger using the freespinprocess");
        const TotalWon = this.match3.freeSpinProcess.getAccumulatedWin();

        if (TotalWon > 0) this.controlPanel.setTitle(`Win ${TotalWon}`);
        else this.controlPanel.setTitle(`GOOD LUCK`);

        this.messageMatchQueuing(this.match3.process.getRoundResult());

        // when both processes are not processing (end of a round)
        if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing()) {
            await this.finish();
            await this.drawWinBannerAsync(this.match3.process.getRoundWin());
        }

        this.controlPanel.enableBetting();
        this.finished = false;

        this.syncFeatureAvailability();
    }

    private onProcessStart() {
        console.log('ON PROCESS START');
        this.lockInteraction();
    }

    private async onProcessComplete() {
        const roundWin = this.match3.process.getRoundWin();

        if (roundWin > 0) this.controlPanel.setTitle(`Win ${roundWin}`);
        else this.controlPanel.setTitle(`GOOD LUCK`);

        this.messageMatchQueuing(this.match3.process.getRoundResult());

        /**
         * ✅ KEY: if NOT in free-spin session, show banner.
         * While waiting & showing popup, keep UI locked.
         */
        if (!this.getFreeSpinProcessing()) {
            this.lockInteraction();
            await this.drawWinBannerAsync(roundWin);
        }

        this.controlPanel.enableBetting();
        this.finished = false;

        this.syncFeatureAvailability();
    }

    private async finish() {
        if (!this.finished) return;
        this.finished = false;
    }

    private async drawWinBannerAsync(winAmount: number): Promise<void> {
        if (winAmount < 50) return;

        await waitFor(1.5);
        await new Promise<void>((resolve) => {
            navigation.presentPopup(SpinRoundBanner, {
                win: winAmount,
                onClosed: resolve,
            });
        });
    }

    private drawTotalWinBanner(winAmount: number) {
        navigation.presentPopup(TotalWinBanner, { win: winAmount });
    }

    private messageMatchQueuing(roundResult: RoundResult) {
        roundResult.map(r => {
            this.controlPanel.addMatchMessage(
                r.multiplier,
                r.type,
                userSettings.getBet() * r.multiplier,
                'krw'
            );
        });

        this.controlPanel.playMatchMessages();
    }
}
