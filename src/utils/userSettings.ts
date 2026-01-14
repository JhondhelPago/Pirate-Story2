import { ConfigAPI } from '../api/configApi';
import { AuthServices, GameServices } from '../api/services';
import { bgm, setMasterVolume, sfx } from './audio';
import { storage } from './storage';


export const loginResponse = await AuthServices.login();

//PIRATE STORY GAME CONFIG
// const response = await ConfigAPI.getPirateConfig();
const response = await GameServices.getGameConfig();
export const config = response.data;

const collectResponse = await GameServices.collect();
console.log("collect response: ", collectResponse);

// interface for the freeSpins and extraFreeSpins
export interface FreeSpinSetting {
    count: number;
    spins: number;
}

// interface for the paytable
export interface PatternSettings {
    min: number;
    max: number;
    multiplier: number;
}

export interface PaytableLedger {
    type: number;
    patterns: PatternSettings[];
}




// Keys for saved items in storage
const KEY_VOLUME_MASTER = 'volume-master';
const KEY_VOLUME_BGM = 'volume-bgm';
const KEY_VOLUME_SFX = 'volume-sfx';

export enum SpinModeEnum {
    Normal = "normal-spin",
    Quick = "quick-spin",
    Turbo = "turbo-spin",
}

type SpinMode = SpinModeEnum.Normal | SpinModeEnum.Quick | SpinModeEnum.Turbo;

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
    private freeSpins: number;
    private currency: string;
    private balance: number;
    private spinIndex: number;

    constructor() {
        this.spinMode = SpinModeEnum.Normal;
        this.currency = config.currency;
        this.balance = 0;
        this.freeSpins = 0;

        this.betOptions = config.bettingLimit.MONEY_OPTION;
        this.betIndex = 0;

        this.spinIndex = -1
        this.balance = 0;

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

    public getBalance() {
        return this.balance;
    }

    public getBet() {
        return this.betOptions[this.betIndex];
    }

    public getFreeSpins() {
        return this.freeSpins;
    }

    public getCurrency() {
        return this.currency;
    }

    /** Adjust bet amount */
    public setBet(type: BetAction) {
        if (type === BetAction.INCREASE && this.betIndex < this.betOptions.length - 1) {
            this.betIndex++;
        } else if (type === BetAction.DECREASE && this.betIndex > 0) {
            this.betIndex--;
        }
    }

    public setBalance(amount: number) {
        this.balance = amount;
    }

    public setFreeSpins(totalSpins: number) {
        this.freeSpins = totalSpins;
    }

    public getSpinIndex() {
        return this.spinIndex;
    }

    public incrementSpinIndex(){
        this.spinIndex++;
        return this.spinIndex
    }

    public async setupCollect(){
        //
        const collectResponse = await GameServices.collect();
        this.spinIndex = collectResponse.index;
        this.balance = collectResponse.balance;
    }

}

/** Shared user settings instance */
export const userSettings = new UserSettings();
