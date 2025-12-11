import { ToggleIconButton } from './ToggleIconButton';
import { bgm, sfx } from '../utils/audio';

/**
 * A button that toggles sound on/off
 */
export class AudioButton extends ToggleIconButton {
    constructor() {
        super({
            imageDefaultOn: 'icon-button-sound-on-default-view',
            imageHoverOn: 'icon-button-sound-on-active-view',
            imagePressedOn: 'icon-button-sound-on-active-view',
            imageDisabledOn: 'icon-button-sound-on-hover-view',
            imageDefaultOff: 'icon-button-sound-off-default-view',
            imageHoverOff: 'icon-button-sound-off-active-view',
            imagePressedOff: 'icon-button-sound-off-active-view',
            imageDisabledOff: 'icon-button-sound-off-hover-view',
        });

        this.onPress.connect(() => {
            this.toggle();
            sfx.setVolume(this.isOn ? 1 : 0);
            bgm.setVolume(this.isOn ? 1 : 0);
        });

        // Initialize with current sound state

        const isOnState = sfx.getVolume() > 0 || bgm.getVolume() > 0;
        this.setToggleState(isOnState);
    }
}
