import { Container, Ticker } from 'pixi.js';
import { Match3, SlotOnJackpotMatchData, SlotOnJackpotTriggerData } from '../slot/Match3';
import { Pillar } from '../ui/Pillar';
import { navigation } from '../utils/navigation';
import { GameEffects } from '../ui/GameEffects';
import { bgm } from '../utils/audio';
import { GameOvertime } from '../ui/GameOvertime';
import { waitFor } from '../utils/asyncUtils';
import { slotGetConfig } from '../slot/Match3Config';
import { JackpotTier } from '../ui/JackpotTier';
import { GameLogo } from '../ui/GameLogo';
import { BuyFreeSpin } from '../ui/BuyFreeSpin';
import { RoundResult } from '../ui/RoundResult';
import { ControlPanel } from '../ui/ControlPanel';
import { BetAction, userSettings } from '../utils/userSettings';
import { BabyZeus } from '../ui/BabyZeus';
import { FreeSpinPopup } from '../popups/FreeSpinPopup';
import { FreeSpinWinPopup } from '../popups/FreeSpinWinPopup';
import { gameConfig } from '../utils/gameConfig';
import { JackpotWinPopup } from '../popups/JackpotWinPopup';

/** The screen tha holds the Match3 game */
export class GameScreen extends Container {
    /** Assets bundles required by this screen */
    public static assetBundles = ['game', 'common'];
    /** The Math3 game */
    public readonly match3: Match3;
    /** Inner container for the match3 */
    public readonly gameContainer: Container;
    /** Countdown displayed when the gameplay is about to finish */
    public readonly overtime: GameOvertime;
    /** The match3 book shelf background */
    public readonly pillar?: Pillar;

    /** The Divine Multiplier */
    public readonly divineJackpotTier: JackpotTier;
    /** The Blessed Multiplier */
    public readonly blessedJackpotTier: JackpotTier;
    /** The Angelic Multiplier */
    public readonly angelicJackpotTier: JackpotTier;
    /** The Grand Multiplier */
    public readonly grandJackpotTier: JackpotTier;

    /** The game logo */
    public readonly gameLogo: GameLogo;

    /** The buy free spin butotn */
    public readonly buyFreeSpin: BuyFreeSpin;

    /** The round result frame */
    public readonly roundResult: RoundResult;
    /** The floading mascot */
    public readonly babyZeus: BabyZeus;

    /** The Control Panel */
    public readonly controlPanel: ControlPanel;

    /** The special effects layer for the match3 */
    public readonly vfx?: GameEffects;

    /** Track if finish */
    public finished: boolean;

    constructor() {
        super();

        this.gameContainer = new Container();
        this.addChild(this.gameContainer);

        this.pillar = new Pillar();
        this.gameContainer.addChild(this.pillar);

        this.gameLogo = new GameLogo();
        this.addChild(this.gameLogo);

        this.buyFreeSpin = new BuyFreeSpin();
        this.addChild(this.buyFreeSpin);

        this.roundResult = new RoundResult();
        this.addChild(this.roundResult);

        this.babyZeus = new BabyZeus();
        this.addChild(this.babyZeus);

        this.divineJackpotTier = new JackpotTier({
            name: 'multiplier-label-divine',
            tier: 'frame_multiplier_divine',
            dotActive: 'multiplier_bullet_divine',
            points: 100,
        });
        this.addChild(this.divineJackpotTier);
        this.divineJackpotTier.setTotalDots(5);
        this.divineJackpotTier.setActiveDots(0);

        this.blessedJackpotTier = new JackpotTier({
            name: 'multiplier-label-blessed',
            tier: 'frame_multiplier_blessed',
            dotActive: 'multiplier_bullet_blessed',
            points: 50,
        });
        this.addChild(this.blessedJackpotTier);
        this.blessedJackpotTier.setTotalDots(4);
        this.blessedJackpotTier.setActiveDots(0);

        this.angelicJackpotTier = new JackpotTier({
            name: 'multiplier-label-angelic',
            tier: 'frame_multiplier_angelic',
            dotActive: 'multiplier_bullet_angelic',
            points: 20,
        });
        this.addChild(this.angelicJackpotTier);
        this.angelicJackpotTier.setTotalDots(3);
        this.angelicJackpotTier.setActiveDots(0);

        this.grandJackpotTier = new JackpotTier({
            name: 'multiplier-label-grand',
            tier: 'frame_multiplier_grand',
            dotActive: 'multiplier_bullet_grand',
            points: 10,
        });
        this.addChild(this.grandJackpotTier);
        this.grandJackpotTier.setTotalDots(2);
        this.grandJackpotTier.setActiveDots(0);

        this.match3 = new Match3();
        this.match3.onSpinStart = this.onSpinStart.bind(this);
        this.match3.onJackpotMatch = this.onJackpotMatch.bind(this);
        this.match3.onJackpotTrigger = this.onJackpotTrigger.bind(this);
        this.match3.onFreeSpinTrigger = this.onFreeSpinTrigger.bind(this);
        this.match3.onFreeSpinStart = this.onFreeSpinStart.bind(this);
        this.match3.onFreeSpinComplete = this.onFreeSpinComplete.bind(this);
        this.match3.onFreeSpinRoundStart = this.onFreeSpinRoundStart.bind(this);
        this.match3.onFreeSpinRoundComplete = this.onFreeSpinRoundComplete.bind(this);
        this.match3.onProcessStart = this.onProcessStart.bind(this);
        this.match3.onProcessComplete = this.onProcessComplete.bind(this);
        this.gameContainer.addChild(this.match3);

        this.vfx = new GameEffects(this);
        this.addChild(this.vfx);

        this.overtime = new GameOvertime();
        this.addChild(this.overtime);

        /** Make sure this is always on bottom */
        this.controlPanel = new ControlPanel();
        this.addChild(this.controlPanel);
        this.controlPanel.setCredit(100000);
        this.controlPanel.setBet(2.0);
        this.controlPanel.setMessage('HOLD SPACE FOR TURBO SPIN');

        this.controlPanel.onSpin(() => this.startSpinning());
        this.controlPanel.onSpacebar(() => this.startSpinning());
        this.controlPanel.onAutoplay(() => {});

        // Init multiplier scores
        this.updateMultiplierAmounts();

        this.controlPanel.setBet(userSettings.getBet());
        this.controlPanel.onIncreaseBet(() => {
            if (this.finished) return;
            userSettings.setBet(BetAction.INCREASE);
            this.controlPanel.setBet(userSettings.getBet());
            this.updateMultiplierAmounts();

            // TODO: Do more here if bet is changed
        });
        this.controlPanel.onDecreaseBet(() => {
            if (this.finished) return;
            userSettings.setBet(BetAction.DECREASE);
            this.controlPanel.setBet(userSettings.getBet());
            this.updateMultiplierAmounts();
            // TODO: Do more here if bet is changed
        });

        this.finished = false;
    }

    private updateMultiplierAmounts() {
        const multipliers = gameConfig.getJackpots();
        for (let index = 0; index < multipliers.length; index++) {
            const element = multipliers[index];
            if (element.id == 'grand') {
                this.grandJackpotTier.amount = userSettings.getBet() * element.multiplier;
            } else if (element.id == 'angelic') {
                this.angelicJackpotTier.amount = userSettings.getBet() * element.multiplier;
            } else if (element.id == 'blessed') {
                this.blessedJackpotTier.amount = userSettings.getBet() * element.multiplier;
            } else if (element.id == 'divine') {
                this.divineJackpotTier.amount = userSettings.getBet() * element.multiplier;
            }
        }
    }

    public startSpinning() {
        if (this.finished) return;
        this.finished = true;
        this.match3.spin();
    }

    /** Prepare the screen just before showing */
    public prepare() {
        const match3Config = slotGetConfig();
        this.pillar?.setup(match3Config);
        this.match3.setup(match3Config);
    }

    /** Update the screen */
    public update(time: Ticker) {
        this.match3.update(time.deltaMS);
    }

    /** Pause gameplay - automatically fired when a popup is presented */
    public async pause() {
        this.gameContainer.interactiveChildren = false;
        this.match3.pause();
    }

    /** Resume gameplay */
    public async resume() {
        this.gameContainer.interactiveChildren = true;
        this.match3.resume();
    }

    /** Fully reset the game, clearing all pieces and shelf blocks */
    public reset() {
        this.pillar?.reset();
        this.match3.reset();
    }

    /** Resize the screen, fired whenever window size changes */
    public resize(width: number, height: number) {
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        if (width > height) {
            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.5;

            this.gameLogo.scale.set(1);
            this.gameLogo.x = width - this.gameLogo.width + 50;
            this.gameLogo.y = this.gameLogo.height * 0.5;

            const multiplierX = width;
            const multiplierTierY = 340;
            const multiplierScale = 1;

            this.divineJackpotTier.scale.set(multiplierScale);
            this.divineJackpotTier.x = multiplierX - this.divineJackpotTier.width * 0.65;
            this.divineJackpotTier.y = multiplierTierY;

            this.blessedJackpotTier.scale.set(multiplierScale);
            this.blessedJackpotTier.x = multiplierX - this.blessedJackpotTier.width * 0.65;
            this.blessedJackpotTier.y = multiplierTierY + 150;

            this.angelicJackpotTier.scale.set(multiplierScale);
            this.angelicJackpotTier.x = multiplierX - this.angelicJackpotTier.width * 0.65;
            this.angelicJackpotTier.y = multiplierTierY + 290;

            this.grandJackpotTier.scale.set(multiplierScale);
            this.grandJackpotTier.x = multiplierX - this.grandJackpotTier.width * 0.65;
            this.grandJackpotTier.y = multiplierTierY + 430;

            this.buyFreeSpin.scale.set(1);
            this.buyFreeSpin.x = 220;
            this.buyFreeSpin.y = 200;

            this.roundResult.scale.set(1);
            this.roundResult.x = 220;
            this.roundResult.y = height - this.roundResult.height - 60;

            this.babyZeus.x = 500;
            this.babyZeus.y = height - this.babyZeus.height * 0.5 - 100;

            this.overtime.x = this.gameContainer.x;
            this.overtime.y = this.gameContainer.y;
        } else {
            const divY = 280;

            this.gameContainer.x = centerX;
            this.gameContainer.y = this.gameContainer.height * 0.5;

            this.buyFreeSpin.scale.set(0.65);
            this.buyFreeSpin.x = 220;
            this.buyFreeSpin.y = height * 0.65 - 20;

            this.gameLogo.scale.set(0.75);
            this.gameLogo.x = 220;
            this.gameLogo.y = height - this.gameLogo.height - divY;

            const multiplierTierY = height * 0.6;
            const multiplierScale = 0.75;

            this.divineJackpotTier.scale.set(multiplierScale);
            this.divineJackpotTier.x = width * 0.5;
            this.divineJackpotTier.y = multiplierTierY;

            this.blessedJackpotTier.scale.set(multiplierScale);
            this.blessedJackpotTier.x = width * 0.5;
            this.blessedJackpotTier.y = multiplierTierY + 110;

            this.angelicJackpotTier.scale.set(multiplierScale);
            this.angelicJackpotTier.x = width * 0.5;
            this.angelicJackpotTier.y = multiplierTierY + 220;

            this.grandJackpotTier.scale.set(multiplierScale);
            this.grandJackpotTier.x = width * 0.5;
            this.grandJackpotTier.y = multiplierTierY + 330;

            this.roundResult.scale.set(0.75);
            this.roundResult.x = width - this.roundResult.width * 0.5 - 40;
            this.roundResult.y = height - this.roundResult.height - 320;

            this.babyZeus.x = 160;
            this.babyZeus.y = centerY - 60;
        }

        const isMobile = document.documentElement.id === 'isMobile';
        this.controlPanel.resize(width, height, isMobile);
    }

    /** Show screen with animations */
    public async show() {
        bgm.play('common/bgm-game.mp3', { volume: 0.5 });
        this.match3.startPlaying();
    }

    /** Hide screen with animations */
    public async hide() {
        this.overtime.hide();
        this.vfx?.playGridExplosion();
        await waitFor(0.3);
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onJackpotMatch(data: SlotOnJackpotMatchData) {
        await this.vfx?.onJackpotMatch(data);
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onJackpotTrigger(data: SlotOnJackpotTriggerData): Promise<void> {
        return new Promise((resolve) => {
            navigation.presentPopup(JackpotWinPopup, async () => {
                await navigation.dismissPopup();
                console.log(data);
                resolve();
            });
        });
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onFreeSpinTrigger(): Promise<void> {
        return new Promise((resolve) => {
            navigation.presentPopup(FreeSpinPopup, async () => {
                await navigation.dismissPopup();
                await waitFor(1);
                this.match3.actions.actionFreeSpin();
                resolve();
            });
        });
    }

    /** Fires when the match3 spins tart */
    private async onSpinStart() {
        console.log('Clear multiplier stats');

        this.divineJackpotTier.setActiveDots(0);
        this.blessedJackpotTier.setActiveDots(0);
        this.angelicJackpotTier.setActiveDots(0);
        this.grandJackpotTier.setActiveDots(0);
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onFreeSpinStart() {
        console.log('FREE SPIN PROCESS STARTING');
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onFreeSpinComplete() {
        return new Promise((resolve) => {
            navigation.presentPopup(FreeSpinWinPopup, {
                winAmount: 1000,
                spinsCount: 3,
                callBack: async () => {
                    await navigation.dismissPopup();
                    await waitFor(1);
                    if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing())
                        this.finish();
                    resolve;
                },
            });
        });
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onFreeSpinRoundStart() {
        console.log('FREE SPIN ROUND PROCESS STARTING');
    }

    /** Fires when the match3 grid finishes auto-processing */
    private async onFreeSpinRoundComplete() {
        console.log('FREE SPIN PROCESS COMPLETED');
    }

    /** Fires when the match3 grid finishes auto-processing */
    private onProcessStart() {
        console.log('PROCESS STARTING');
    }

    /** Fires when the match3 grid finishes auto-processing */
    private onProcessComplete() {
        if (!this.match3.process.isProcessing() && !this.match3.freeSpinProcess.isProcessing()) this.finish();
    }

    private async finish() {
        if (!this.finished) return;
        this.finished = false;
    }

    /** Auto pause the game when window go out of focus */
    public blur() {
        if (!navigation.currentPopup) {
            // navigation.presentPopup(PausePopup);
        }
    }
}
