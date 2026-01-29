import { Container, Ticker } from 'pixi.js';
import { Slot } from '../slot/Slot';
import { navigation } from '../utils/navigation';
import { bgm } from '../utils/audio';
import { waitFor } from '../utils/asyncUtils';
import { slotGetConfig } from '../slot/Match3Config';
import { GameLogo } from '../ui/GameLogo';
import { BuyFreeSpin } from '../ui/BuyFreeSpin';
import { ControlPanel } from '../ui/ControlPanel';
import { BetAction, SpinModeEnum, userSettings } from '../utils/userSettings';
import { GoldRoger } from '../ui/GoldRoger';
import { BarrelBoard } from '../ui/BarrelBoard';
import { InfoPopup, InfoPopupData } from '../popups/InfoPopup';
import { getBannerDict, SpinRoundBanner } from '../popups/SpinRoundBanner';
import { getPatternByCount, RoundResult } from '../slot/SlotUtility';
import { SettingsPopup } from '../popups/SettingsPopup';
import { TotalWinBanner } from '../popups/TotalWinBanner';
import { AutoplayPopup, AutoplayPopupData } from '../popups/AutoplayPopup';
import { FreeSpinWinBanner } from '../popups/FreeSpinWinBanner';
import { SlotFreeSpinProcess } from '../slot/SlotFreeSpinProcess';
import { collect } from '../api/services/gameServices';
import { i18n } from '../i18n/i18n';

export type SettingsPopupData = {
    finished: boolean;
    onBetSettingChanged: () => void;
    onAudioSettingChanged: (isOn: boolean) => void;
};

/** The screen that holds the Match3 game */
export class GameScreen extends Container {
    public static assetBundles = ['game', 'common'];

    public readonly slot: Slot;
    public readonly gameContainer: Container;

    public readonly barrelBoard?: BarrelBoard;

    /** The game logo */
    public readonly gameLogo: GameLogo;

    /** The buy free spin button */
    public readonly buyFreeSpin: BuyFreeSpin;

    /** The floating mascot */
    public readonly goldRoger: GoldRoger;

    /** The Control Panel */
    public readonly controlPanel: ControlPanel;

    /** Track if finish */
    public finished: boolean;

    public isResuming = false;

    constructor() {
        super();

        this.gameContainer = new Container();
        this.addChild(this.gameContainer);

        this.barrelBoard = new BarrelBoard('Barrel-Board');
        this.barrelBoard.scale.set(1.4);
        this.gameContainer.addChild(this.barrelBoard);

        this.gameLogo = new GameLogo();
        this.addChild(this.gameLogo);

        this.buyFreeSpin = new BuyFreeSpin();
        this.addChild(this.buyFreeSpin);
        this.buyFreeSpin.show(); // visible always

        this.goldRoger = new GoldRoger();
        this.goldRoger.scale.set(1);
        this.goldRoger.playIdle();
        this.addChild(this.goldRoger);

        /** Match3 core */
        this.slot = new Slot();
        this.slot.onSpinStart = this.onSpinStart.bind(this);
        this.slot.onFreeSpinStart = this.onFreeSpinStart.bind(this);
        this.slot.onFreeSpinComplete = this.onFreeSpinComplete.bind(this);
        this.slot.onFreeSpinRoundStart = this.onFreeSpinRoundStart.bind(this);
        this.slot.onFreeSpinRoundComplete = this.onFreeSpinRoundComplete.bind(this);
        this.slot.onFreeSpinInitialBonusScatterComplete = this.onFreeSpinInitialBonusScatterComplete.bind(this);
        this.slot.onFreeSpinResumeStart = this.onFreeSpinResumeStart.bind(this);

        this.slot.onAutoSpinStart = this.onAutoSpinStart.bind(this);
        this.slot.onAutoSpinComplete = this.onAutoSpinComplete.bind(this);
        this.slot.onAutoSpinRoundStart = this.onAutoSpinRoundStart.bind(this);
        this.slot.onAutoSpinRoundComplete = this.onAutoSpinRoundComplete.bind(this);

        // ✅ IMPORTANT CHANGE:
        // Use an async callback that returns Promise<void>, so Match3 can await it
        // (Match3.switchToFreeSpin will do: await this.onAutoSpinWonToFreeSpin?.(spins);)
        this.slot.onAutoSpinWonToFreeSpin = async (spins: number) => {
            await waitFor(3);
            await this.drawFreeSpinWonBanner(spins);
        };

        this.slot.onProcessStart = this.onProcessStart.bind(this);
        this.slot.onProcessComplete = this.onProcessComplete.bind(this);
        this.slot.scale.set(1.2);
        this.gameContainer.addChild(this.slot);

        console.log('balance from settings: ', userSettings.getBalance());
        /** Control panel */
        this.controlPanel = new ControlPanel();
        this.addChild(this.controlPanel);
        this.controlPanel.setCredit(userSettings.getBalance());
        this.controlPanel.setBet(2.0);
        this.controlPanel.setMessage(i18n.t('holdSpaceForTurboSpin'));

        // ✅ Spin now supports interrupt-on-second-press
        this.controlPanel.onSpin(() => this.startSpinning());
        this.controlPanel.onSpacebar(() => this.startSpinning());

        this.controlPanel.onAutoplay(() => {
            const spinMode = 'normal-spin';
            navigation.presentPopup<AutoplayPopupData>(AutoplayPopup, {
                spinMode,
                callback: async (spins: number) => {
                    if (this.finished) return;
                    await navigation.dismissPopup();
                    this.onAutoSpinStart(spins);
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

        // Bet buttons still work normally (but are disabled when busy)
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

    private getNormalProcessing(): boolean {
        return this.slot.process?.isProcessing?.() ?? false;
    }

    private getFreeSpinProcessing(): boolean {
        return this.slot.freeSpinProcess?.getFreeSpinProcessing?.() ?? false;
    }

    private getAutoSpinProcessing(): boolean {
        return this.slot.autoSpinProcess?.getAutoSpinProcessing?.() ?? false;
    }
    private syncFeatureAvailability() {
        const normalProcessing = this.getNormalProcessing();
        const freeSpinProcessing = this.getFreeSpinProcessing();
        const autoSpinProcessing = this.getAutoSpinProcessing();

        // ✅ treat "resume" as busy too
        const canInteract = !this.isResuming && !normalProcessing && !freeSpinProcessing && !autoSpinProcessing;

        this.buyFreeSpin.setEnabled(canInteract);

        if (canInteract) this.controlPanel.enableBetting();
        else this.controlPanel.disableBetting();
    }

    /** Hard lock (used while waiting + while popup is showing) */
    private lockInteraction() {
        this.buyFreeSpin.setEnabled(false);
        this.controlPanel.disableBetting();
    }

    private requestSpinInterrupt() {
        this.slot.board.hasIncomingSpinTrigger = true;
        this.slot.board.interruptSpin();
    }

    // =========================================================================
    // SPIN ENTRY
    // =========================================================================
    public async startSpinning() {
        // block the trigger of the spin if there is current popups, to prevent keyboard input to trigger spins
        if (navigation.currentPopup) return;

        // Second press while spinning = interrupt
        if (this.slot.spinning) {
            this.requestSpinInterrupt();
            return;
        }

        if (this.slot.process instanceof SlotFreeSpinProcess && this.slot.process.getIsInitialFreeSpin()) return; // preventing spin trigger while on the free spin initial bonus spin

        // Don’t start a new spin if any process is busy
        if (this.getNormalProcessing() || this.getFreeSpinProcessing() || this.getAutoSpinProcessing()) return;

        // If we’re idle but animations are still looping, stop them before spinning
        this.slot.board.hasIncomingSpinTrigger = true;

        this.lockInteraction();
        await this.slot.spin();
    }

    public freeSpinStartSpinning(spins: number) {
        if (this.finished) return;
        if (this.getNormalProcessing() || this.getFreeSpinProcessing() || this.getAutoSpinProcessing()) return;

        this.lockInteraction();
        this.slot.freeSpin(spins);
        this.finished = true;
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    public prepare() {
        const match3Config = slotGetConfig();
        this.barrelBoard?.setup(match3Config);
        this.slot.setup(match3Config);
        this.syncFeatureAvailability();
    }

    public update(time: Ticker) {
        this.slot.update(time.deltaMS);
    }

    public async pause() {
        this.gameContainer.interactiveChildren = false;
        this.slot.pause();
    }

    public async resume() {
        this.gameContainer.interactiveChildren = true;
        this.slot.resume();
    }

    public reset() {
        this.barrelBoard?.reset();
        this.slot.reset();
        this.syncFeatureAvailability();
    }

    public resize(width: number, height: number) {
        const centerX = width * 0.5;

        if (width > height) {
            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.5 - 65;

            this.gameLogo.scale.set(0.35);
            this.gameLogo.x = 235;
            this.gameLogo.y = height * 0.15;

            this.buyFreeSpin.scale.set(1);
            this.buyFreeSpin.x = 220;
            this.buyFreeSpin.y = 480;

            this.goldRoger.x = width + 50;
            this.goldRoger.y = height + 260;
        } else {
            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.7;

            this.barrelBoard?.scale.set(1.45);
            this.slot.scale.set(1.25);

            this.buyFreeSpin.scale.set(1);
            this.buyFreeSpin.x = 230;
            this.buyFreeSpin.y = height * 0.73;

            this.gameLogo.scale.set(0.32);
            this.gameLogo.x = width * 0.5;
            this.gameLogo.y = 130;

            this.goldRoger.x = width + 160;
            this.goldRoger.y = height + 320;
            this.goldRoger.scale.set(1);
        }

        const isMobile = document.documentElement.id === 'isMobile';
        this.controlPanel.resize(width, height, isMobile);
    }

    public async show() {
        bgm.play('common/bgm-game.mp3', { volume: 0.3 });
        this.slot.startPlaying();
        this.syncFeatureAvailability();
    }

    public async hide() {
        navigation.background?.blur?.();
        await waitFor(0.3);
    }

    private async onSpinStart() {
        this.controlPanel.setCredit(userSettings.getBalance());
        this.lockInteraction();
    }

    private onProcessStart() {
        console.log('ON PROCESS START');
        this.lockInteraction();
    }

    private async onProcessComplete() {
        const roundWin = this.slot.process.getRoundWin();
        if (roundWin > 0) {
            this.controlPanel.setCredit(userSettings.getBalance());
            this.controlPanel.setWinTitle(i18n.t('win', { amount: roundWin }));
        } else {
            this.controlPanel.setTitle(i18n.t('goodluck'));
        }

        this.messageMatchQueuing(this.slot.process.getRoundResult());

        // ✅ If NOT in free-spin session, show banner. Keep UI locked while popup shows.
        if (!this.getFreeSpinProcessing()) {
            this.lockInteraction();
            await this.drawWinBannerAsync(roundWin);
        }

        // check for bonus and process switching if there is passed bonus condition
        await this.checkBonus('normalspin');

        this.controlPanel.enableBetting();
        this.finished = false;

        this.syncFeatureAvailability();
    }

    public async onAutoSpinStart(spins: number) {
        if (this.finished) return;
        if (this.slot.autoSpinProcess.getAutoSpinProcessing()) return;

        this.lockInteraction();
        this.slot.autoSpin(spins);
        this.finished = true;
    }

    private async onAutoSpinComplete(current: number) {
        console.log(`Total Won in ${current} Auto Spin: `, this.slot.autoSpinProcess.getAccumulatedWin());

        // ✅ Unlock only when auto spin session is finished
        this.controlPanel.enableBetting();
        this.finished = false;

        this.syncFeatureAvailability();
    }

    private async onAutoSpinRoundStart(current: number, remaining: number) {
        this.controlPanel.setCredit(userSettings.getBalance());
        console.log('Current Spin: ', current, 'Remaining Spins: ', remaining);
        console.log('remaining spins left failed to display if there is no winning round');

        this.controlPanel.setMessage(`REMAINING SPINS LEFT ${remaining}`);

        this.lockInteraction();
    }

    private async onAutoSpinRoundComplete() {
        const roundWin = this.slot.autoSpinProcess.getRoundWin();
        if (roundWin > 0) {
            this.controlPanel.setCredit(userSettings.getBalance());
        }

        const totalWon = this.slot.autoSpinProcess.getAccumulatedWin();

        if (totalWon > 0) {
            this.controlPanel.setWinTitle(`Win ${totalWon}`);
            this.messageMatchQueuing(this.slot.autoSpinProcess.getRoundResult());
        } else {
            this.controlPanel.setTitle(i18n.t('goodluck'));
        }

        await this.finish();

        // check for bonus and process switching if there is passed bonus condition
        await this.checkBonus('autospin');

        if (this.slot.autoSpinProcess.getAutoSpinProcessing()) {
            this.lockInteraction();
        }

        this.syncFeatureAvailability();
    }

    public async onFreeSpinInitialStart(spins: number, featureCode: number) {
        if (this.finished) return;
        if (this.getFreeSpinProcessing()) return;

        this.goldRoger.playAction();
        await waitFor(1);

        // set updated Credit here
        this.controlPanel.setCredit(userSettings.getBalance());
        this.controlPanel.setTitle('');

        this.lockInteraction();
        this.slot.freeSpinInitial(spins, featureCode);
        this.finished = true;
    }

    public async onFreeSpinStart(spins: number) {
        if (this.finished) return;
        if (this.getFreeSpinProcessing()) return;

        this.lockInteraction();
        this.slot.freeSpin(spins);
        this.finished = true;
    }

    private async onFreeSpinComplete(current: number) {
        console.log(`Total Won in ${current} Free Spin: `, this.slot.freeSpinProcess.getAccumulatedWin());
        this.controlPanel.setMessage('');
        this.controlPanel.setCredit(userSettings.getBalance());

        // sure lines to correct and prevent wrong credit display
        collect().then((result) => {
            this.controlPanel.setCredit(result.balance);
            userSettings.setBalance(result.balance);
        });

        // hard lock while banner is open
        this.lockInteraction();

        // show banner and wait close
        await this.drawTotalWinBanner(this.slot.freeSpinProcess.getAccumulatedWin(), current);

        this.isResuming = false;
        this.syncFeatureAvailability();
    }

    private async onFreeSpinRoundStart(current: number, remaining: number) {
        console.log('Current Spin: ', current, 'Remaining Spins: ', remaining);
        this.controlPanel.setMessage(`FREE SPIN LEFT ${remaining}`);

        this.lockInteraction();
    }

    private async onFreeSpinRoundComplete() {
        const totalWon = this.slot.freeSpinProcess.getAccumulatedWin();
        if (totalWon > 0) {
            this.controlPanel.setWinTitle(i18n.t('win', { amount: totalWon }));
        } else {
            this.controlPanel.setTitle(i18n.t('goodluck'));
        }

        this.messageMatchQueuing(this.slot.freeSpinProcess.getRoundResult());

        if (!this.slot.freeSpinProcess.isProcessing()) {
            await this.finish();
            await this.drawWinBannerAsync(this.slot.freeSpinProcess.getRoundWin());
        }

        // do not switch process, instead check bonus for extra free spins, then add spin sessions
        await this.checkBonus('freespin');

        this.controlPanel.enableBetting();
        this.finished = false;

        this.syncFeatureAvailability();
    }

    private async onFreeSpinInitialBonusScatterComplete(currentSpin: number) {
        this.finished = false;
        await waitFor(3);
        await this.drawFreeSpinWonBanner(currentSpin);
        this.controlPanel.setWinTitle(i18n.t('win', { amount: this.slot.freeSpinProcess.getAccumulatedWin() })); // this will get the intial accumulated win set by the Match3FreeSpinProcess.runInitialBonusProcess()

        this.syncFeatureAvailability();
    }

    private async onFreeSpinResumeStart() {
        // this.controlPanel.setMessage(`FREE SPIN LEFT ${spins}`);
        console.log('lock interactions from onFreeSpinResumeStart');
        this.isResuming = true;
        this.lockInteraction();
    }

    private async finish() {
        if (!this.finished) return;
        this.finished = false;
    }

    private async drawWinBannerAsync(winAmount: number): Promise<void> {
        const lowestMin = Math.min(...getBannerDict().map((item) => item.min));
        if (winAmount < lowestMin) return; // skip if win is below minimum

        await waitFor(1.5);

        await new Promise<void>((resolve) => {
            navigation.presentPopup(SpinRoundBanner, {
                win: winAmount,
                onClosed: resolve,
            });
        });
    }


    private drawTotalWinBanner(winAmount: number, freeSpins: number): Promise<void> {
        const hasPrevProcess = this.slot.getStackSize() > 0;
        const spinMode = userSettings.getSpinMode();
        let duration = 0;

        switch (spinMode) {
            case SpinModeEnum.Normal:
                duration = 6000;
                break;
            case SpinModeEnum.Quick:
                duration = 4500;
                break;
            case SpinModeEnum.Turbo:
                duration = 3000;
                break;
        }

        if (hasPrevProcess) {
            return new Promise((resolve) => {
                navigation.presentPopup(TotalWinBanner, {
                    win: winAmount,
                    spins: freeSpins,
                    autoClose: true,
                    duration: duration,
                    onClosed: () => resolve(), // resolves when banner closes
                });
            });
        } else {
            return new Promise((resolve) => {
                navigation.presentPopup(TotalWinBanner, {
                    win: winAmount,
                    spins: freeSpins,
                    onClosed: () => resolve(), // resolves when banner closes
                });
            });
        }
    }

    private drawFreeSpinWonBanner(spins: number, initiateSpin: boolean = true): Promise<void> {
        const hasPrevProcess = this.slot.getStackSize() > 0;
        const spinMode = userSettings.getSpinMode();
        let duration = 0;

        switch (spinMode) {
            case SpinModeEnum.Normal:
                duration = 6000;
                break;
            case SpinModeEnum.Quick:
                duration = 4500;
                break;
            case SpinModeEnum.Turbo:
                duration = 3000;
                break;
        }

        return new Promise<void>((resolve) => {
            navigation.presentPopup(FreeSpinWinBanner, {
                spins,
                autoClose: true,
                duration: hasPrevProcess ? duration : duration + 2000,
                onClosed: () => {
                    if (initiateSpin) {
                        this.onFreeSpinStart(spins); // start the free spin session after closing the banner
                    }
                    resolve();
                },
            });
        });
    }

    private messageMatchQueuing(roundResult: RoundResult) {
        if (!roundResult || roundResult.length === 0) return;
        roundResult.forEach((r) => {
            const baseWin = getPatternByCount(r.type, r.count)?.multiplier * userSettings.getBet();

            this.controlPanel.addMatchMessage(r.count, r.type, baseWin, 'krw');
        });

        this.controlPanel.playMatchMessages();
    }

    private async checkBonus(feature: string) {
        let spinWon = 0;

        switch (feature) {
            case 'normalspin': {
                spinWon = await this.slot.process.getSpinWon();
                if (spinWon > 0) {
                    await this.slot.switchToFreeSpin(spinWon, { initial: false });
                }
                return;
            }

            case 'autospin': {
                spinWon = await this.slot.autoSpinProcess.getSpinWon();
                if (spinWon > 0) {
                    await this.slot.switchToFreeSpin(spinWon, { initial: false });
                }
                return;
            }

            case 'freespin': {
                spinWon = await this.slot.freeSpinProcess.getSpinWon();
                if (spinWon > 0) {
                    await waitFor(0.5); // wait so the navigation have time to dismiss the current popup
                    await this.drawFreeSpinWonBanner(spinWon, false);
                    this.slot.freeSpinProcess.addSpins(spinWon);
                }
                return;
            }
        }
    }
}
