import { Container } from 'pixi.js';
import { Match3Actions } from './Match3Actions';
import { Match3Board } from './Match3Board';
import { Jackpot, Match3Config, slotGetConfig } from './Match3Config';
import { Match3Process } from './Match3Process';
import { Match3Stats } from './Match3Stats';
import { Match3FreeSpinProcess } from './Match3FreeSpinProcess';
import { SlotSymbol } from './SlotSymbol';
import { Match3RoundResults } from './Match3RounResults';
import { Match3Jackpot } from './Match3Jackpot';
import { gameConfig } from '../utils/gameConfig';

// Match3.ts - Holds the state
export enum SpinState {
    IDLE = 'idle',
    SPINNING = 'spinning',
    COMPLETE = 'complete',
}

/** Interface for onMatch event data */
export interface SlotOnJackpotMatchData {
    /** List of all matches detected in the grid */
    symbols: SlotSymbol[];
}

/** Interface for onMatch event data */
export interface SlotOnJackpotTriggerData {
    /** List of all jackpot matches detected in the grid */
    jackpot: Jackpot;
    /** Occurance */
    times: number;
}

/**
 * The main match3 class that sets up game's sub-systems and provide some useful callbacks.
 * All game events are set as plain callbacks for simplicity
 */
export class Match3 extends Container {
    /** State if spinning */
    public spinning: boolean;

    /** Match3 game basic configuration */
    public config: Match3Config;
    /** Compute score, grade, number of matches */
    public stats: Match3Stats;
    /** Display number of matches */
    public roundResults: Match3RoundResults;
    /** Holds the grid state and display */
    public board: Match3Board;
    /** Sort out actions that the player can take */
    public actions: Match3Actions;
    /** Process matches and fills up the grid */
    public process: Match3Process;
    /** Process matches and fills up the grid */
    public freeSpinProcess: Match3FreeSpinProcess;
    /** Handles pieces with special powers */
    public jackpot: Match3Jackpot;

    /** Firew when a spin started, regardless of the spin type */
    public onSpinStart?: () => void;
    /** Firew when free spin triggered */
    public onFreeSpinTrigger?: () => void;
    /** Fires when special triggered */
    public onJackpotMatch?: (data: SlotOnJackpotMatchData) => Promise<void>;
    /** Fires when multiplier jackpot triggered */
    public onJackpotTrigger?: (data: SlotOnJackpotTriggerData) => Promise<void>;

    /** Fires when the game start auto-processing the grid */
    public onFreeSpinStart?: (count: number) => void;
    /** Fires when the game finishes auto-processing the grid */
    public onFreeSpinComplete?: () => void;
    /** Fires when the game start auto-processing the grid */
    public onFreeSpinRoundStart?: (currentCount: number, remainingCount: number) => void;
    /** Fires when the game start auto-processing the grid */
    public onFreeSpinRoundComplete?: (currentCount: number, remainingCount: number) => void;

    /** Fires when the game start auto-processing the grid */
    public onProcessStart?: () => void;
    /** Fires when the game finishes auto-processing the grid */
    public onProcessComplete?: () => void;

    constructor() {
        super();
        this.spinning = false;

        // Game sub-systems
        this.config = slotGetConfig();
        this.stats = new Match3Stats(this);
        this.roundResults = new Match3RoundResults(this);
        this.board = new Match3Board(this);
        this.actions = new Match3Actions(this);
        this.process = new Match3Process(this);
        this.jackpot = new Match3Jackpot(this);
        this.freeSpinProcess = new Match3FreeSpinProcess(this);
    }

    /**
     * Sets up a new match3 game with pieces, rows, columns, duration, etc.
     * @param config The config object in which the game will be based on
     */
    public setup(config: Match3Config) {
        const jackpotConfig = gameConfig.getJackpots();
        this.config = config;
        this.reset();

        this.jackpot.setup(jackpotConfig);
        this.board.setup(config);
    }

    /** Fully reset the game */
    public reset() {
        this.interactiveChildren = false;
        this.stats.reset();
        this.board.reset();
        this.process.reset();
        this.freeSpinProcess.reset();
        this.jackpot.reset();
    }

    /** Start the spin and disable interaction */
    public async spin() {
        if (this.spinning) return;
        this.spinning = true;
        await this.actions.actionSpin();
        this.spinning = false;
    }

    /** Start the spin and disable interaction */
    public async freeSpin() {
        if (this.spinning) return;
        this.spinning = true;
        await this.actions.actionFreeSpin();
        this.spinning = false;
    }

    /** Start the timer and enable interaction */
    public startPlaying() {
        // this.board.fallFromTop();
    }

    /** Check if the game is still playing */
    public isSpinning() {
        return this.spinning;
    }

    /** Pause the game */
    public pause() {
        this.board.pause();
        this.process.pause();
    }

    /** Resume the game */
    public resume() {
        this.board.resume();
        this.process.resume();
    }

    /** Update the timer */
    public update(_delta: number) {
        // this.timer.update(delta);
    }
}
