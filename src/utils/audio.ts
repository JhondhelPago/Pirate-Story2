import { PlayOptions, Sound, sound } from '@pixi/sound';
import gsap from 'gsap';

/**
 * Handles music background, playing onle one audio file in loop at time,
 * and fade/stop the music if a new one is requested. Also provide volume
 * control for music background only, leaving other sounds volumes unchanged.
 */
class BGM {
    /** Alias of the current music being played */
    public currentAlias?: string;
    /** Current music instance being played */
    public current?: Sound;
    /** Current volume set */
    private volume = 1;

    /** Play a background music, fading out and stopping the previous, if there is one */
    public async play(alias: string, options?: PlayOptions) {
        // Do nothing if the requested music is already being played
        if (this.currentAlias === alias) return;

        // Fade out then stop current music
        if (this.current) {
            const current = this.current;
            gsap.killTweensOf(current);
            gsap.to(current, { volume: 0, duration: 1, ease: 'linear' }).then(() => {
                current.stop();
            });
        }

        // Find out the new instance to be played
        this.current = sound.find(alias);

        // Play and fade in the new music
        this.currentAlias = alias;
        this.current.play({ loop: true, ...options });
        this.current.volume = 0;
        gsap.killTweensOf(this.current);
        gsap.to(this.current, { volume: this.volume, duration: 1, ease: 'linear' });
    }

    /** Get background music volume */
    public getVolume() {
        return this.volume;
    }

    /** Set background music volume */
    public setVolume(v: number) {
        this.volume = v;
        if (this.current) this.current.volume = this.volume;
    }
}

/**
 * Handles short sound special effects, mainly for having its own volume settings.
 * The volume control is only a workaround to make it work only with this type of sound,
 * with a limitation of not controlling volume of currently playing instances - only the new ones will
 * have their volume changed. But because most of sound effects are short sounds, this is generally fine.
 */

type SoundInstance = any;

class SFX {
    /** Volume scale for new instances */
    private volume = 1;

    /** All currently looping SFX instances */
    private loopingInstances = new Set<SoundInstance>();

    /** Play a sound effect (one-shot or looped) */
    public play(alias: string, options?: PlayOptions): SoundInstance {
        const volume = this.volume * (options?.volume ?? 1);

        const instance = sound.play(alias, {
            ...options,
            volume,
        });

        if (options?.loop) {
            this.trackLoop(instance);
        }

        return instance;
    }

    public playLoopTimes(alias: string, times: number, options?: PlayOptions): SoundInstance {
        if (times <= 0) return null;

        let played = 0;
        let instance: SoundInstance;

        const playOnce = () => {
            instance = this.play(alias, {
                ...options,
                loop: false, // IMPORTANT: no native loop
            });

            played++;

            instance?.once?.('end', () => {
                if (played < times) {
                    playOnce();
                }
            });
        };

        playOnce();
        return instance;
    }

    /** Play only a segment of a sound (supports looping) */
    public playSegment(alias: string, start: number, duration: number, options?: PlayOptions): SoundInstance {
        const volume = this.volume * (options?.volume ?? 1);

        const instance = sound.play(alias, {
            ...options,
            start,
            end: start + duration,
            volume,
        });

        if (options?.loop) {
            this.trackLoop(instance);
        }

        return instance;
    }

    /** Track a looping instance and auto-untrack on stop/end */
    private trackLoop(instance: SoundInstance) {
        this.loopingInstances.add(instance);

        const originalStop = instance.stop?.bind(instance);

        instance.stop = () => {
            try {
                originalStop?.();
            } catch {
                // do nothing
            }
            this.loopingInstances.delete(instance);
        };
    }

    public stopAll() {
        // stop tracked loops
        this.stopAllLoops();

        // stop any Pixi Sound instance (including suspended)
        sound.stopAll();
    }

    /** Stop ALL looping SFX immediately (tab switch safety) */
    public stopAllLoops() {
        for (const inst of this.loopingInstances) {
            try {
                inst.stop?.();
            } catch {
                // do nothing
            }
        }
        this.loopingInstances.clear();
    }

    /** Get sound effects volume */
    public getVolume() {
        return this.volume;
    }

    /** Set sound effects volume (affects new instances only) */
    public setVolume(v: number) {
        this.volume = v;
    }
}

/** Get overall sound volume */
export function getMasterVolume() {
    return sound.volumeAll;
}

/** Set the overall sound volume, affecting all music and sound effects */
export function setMasterVolume(v: number) {
    sound.volumeAll = v;
    if (!v) {
        sound.muteAll();
    } else {
        sound.unmuteAll();
    }
}
/** Shared background music controller */
export const bgm = new BGM();

/** Shared sound effects controller */
export const sfx = new SFX();
