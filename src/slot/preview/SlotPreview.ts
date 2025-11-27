import { Container } from 'pixi.js';
import { Match3Config, slotGetConfig } from '../Match3Config';
import { Match3Position, Match3Type } from '../SlotUtility';
import { Match3BoardPreview } from './Match3BoardPreview';

/** Interface for onMatch event data */
export interface Match3OnMatchData {
    /** List of all matches detected in the grid */
    matches: Match3Position[][];
    /** Combo level - starting from 1 */
    combo: number;
}

/** Interface for onPop event data */
export interface Match3OnPopData {
    /** The type of the piece popped out */
    type: Match3Type;
    /** Current combo level */
    combo: number;
    /** Tells if the given type is a special type */
    isSpecial: boolean;
    /** True if the piece was popped from special effect, not plain match */
    causedBySpecial: boolean;
}

/** Interface for onMove event data */
export interface Match3OnMoveData {
    /** The starting grid position of the move */
    from: Match3Position;
    /** The ending grid position of the move */
    to: Match3Position;
    /** True if is a valid movement (creates a match) */
    valid: boolean;
}

/**
 * The main match3 class that sets up game's sub-systems and provide some useful callbacks.
 * All game events are set as plain callbacks for simplicity
 */
export class SlotPreview extends Container {
    /** Match3 game basic configuration */
    public config: Match3Config;
    /** Holds the grid state and display */
    public board: Match3BoardPreview;

    constructor() {
        super();

        // Game sub-systems
        this.config = slotGetConfig();
        this.board = new Match3BoardPreview(this);
    }

    /**
     * Sets up a new match3 game with pieces, rows, columns, duration, etc.
     * @param config The config object in which the game will be based on
     */
    public setup(config: Match3Config) {
        this.config = config;
        this.reset();
        this.board.setup(config);
    }

    /** Fully reset the game */
    public reset() {
        this.interactiveChildren = false;
        this.board.reset();
    }
    /** Stop the timer and disable interaction */
    public stopPlaying() {
        this.interactiveChildren = false;
        console.log('Stop playing');
    }

    /** Check if the game is still playing */
    public isPlaying() {
        return this.interactiveChildren;
    }

    /** Pause the game */
    public pause() {
        this.board.pause();
    }

    /** Resume the game */
    public resume() {
        this.board.resume();
    }

    /** Update the timer */
    public update(_delta: number) {
        // this.timer.update(delta);
    }
}
