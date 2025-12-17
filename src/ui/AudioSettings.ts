import { Container } from 'pixi.js';
import { AudioSwitcher } from './AudioSwitcher';
import { i18n } from '../i18n/i18n';

export interface AudioSettingsOptions {
    gap?: number;
    width?: number;
}

/**
 * A component that contains audio settings (Ambient Music and Sound FX switchers)
 */
export class AudioSettings extends Container {
    /** Sound FX Switch */
    public soundFXSwitcher: AudioSwitcher;
    /** Ambient Music Switch */
    public ambientMusicSwitcher: AudioSwitcher;
    /** Gap between switchers */
    private gap: number;

    constructor(options: AudioSettingsOptions = {}) {
        super();

        this.gap = options.gap ?? 50;
        const width = options.width ?? 300;

        /** Ambient music Switcher */
        this.ambientMusicSwitcher = new AudioSwitcher({
            title: i18n.t('ambientMusicSwitch'),
            description: i18n.t('ambientMusicSwitchDesc'),
            width,
        });
        this.addChild(this.ambientMusicSwitcher);

        /** Sound FX */
        this.soundFXSwitcher = new AudioSwitcher({
            title: i18n.t('soundFXSwitch'),
            description: i18n.t('soundFXSwitchDesc'),
            width,
        });

        this.soundFXSwitcher.y = this.ambientMusicSwitcher.height + this.gap;
        this.addChild(this.soundFXSwitcher);
    }

    /**
     * Initialize the switchers with current audio state
     */
    public setup(isAmbientMusicOn: boolean, isSoundFXOn: boolean): void {
        this.ambientMusicSwitcher.switcher.forceSwitch(isAmbientMusicOn ? 1 : 0);
        this.soundFXSwitcher.switcher.forceSwitch(isSoundFXOn ? 1 : 0);
    }
}
