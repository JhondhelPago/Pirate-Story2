import { bgm, setMasterVolume, sfx } from './audio';
import { storage } from './storage';

// Keys for saved items in storage
const KEY_VOLUME_MASTER = 'volume-master';
const KEY_VOLUME_BGM = 'volume-bgm';
const KEY_VOLUME_SFX = 'volume-sfx';

type SpinMode = 'quick-spin' | 'turbo-spin' | 'normal-spin';

export enum BetAction {
    INCREASE = 'increase',
    DECREASE = 'decrease',
}

/**
 * Persistent user settings of volumes and game mode.
 */
class UserSettings {
    private spinMode: SpinMode;
    private betIndex: number;
    private betOptions: number[];

    constructor() {
        this.spinMode = 'normal-spin';

        this.betOptions = [5, 10, 15, 20, 50, 100, 1000];
        this.betIndex = 0;

        setMasterVolume(this.getMasterVolume());
        bgm.setVolume(this.getBgmVolume());
        sfx.setVolume(this.getSfxVolume());
    }

    /** Get overall sound volume */
    public getMasterVolume() {
        return storage.getNumber(KEY_VOLUME_MASTER) ?? 0.5;
    }

    /** Set overall sound volume */
    public setMasterVolume(value: number) {
        setMasterVolume(value);
        storage.setNumber(KEY_VOLUME_MASTER, value);
    }

    /** Get background music volume */
    public getBgmVolume() {
        return storage.getNumber(KEY_VOLUME_BGM) ?? 1;
    }

    /** Set background music volume */
    public setBgmVolume(value: number) {
        bgm.setVolume(value);
        storage.setNumber(KEY_VOLUME_BGM, value);
    }

    /** Get sound effects volume */
    public getSfxVolume() {
        return storage.getNumber(KEY_VOLUME_SFX) ?? 1;
    }

    /** Set sound effects volume */
    public setSfxVolume(value: number) {
        sfx.setVolume(value);
        storage.setNumber(KEY_VOLUME_SFX, value);
    }

    /** Get spin mode */
    public getSpinMode() {
        return this.spinMode;
    }

    /** Set spin mode */
    public setSpinMode(mode: SpinMode) {
        this.spinMode = mode;
    }

    public getBet() {
        return this.betOptions[this.betIndex];
    }

    /** Adjust bet amount */
    public setBet(type: BetAction) {
        if (type === BetAction.INCREASE && this.betIndex < this.betOptions.length - 1) {
            this.betIndex++;
        } else if (type === BetAction.DECREASE && this.betIndex > 0) {
            this.betIndex--;
        }
    }
}

/** SHared user settings instance */
export const userSettings = new UserSettings();
