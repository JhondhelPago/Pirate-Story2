import { Container } from 'pixi.js';
import { Match3Actions } from './Match3Actions';
import { Match3Board } from './Match3Board';
import { Match3Config, slotGetConfig } from './Match3Config';
import { Match3Process } from './Match3Process';
import { Match3Stats } from './Match3Stats';
import { Match3FreeSpinProcess } from './Match3FreeSpinProcess';
import { Match3AutoSpinProcess } from './Match3AutoSpinProcess'; // ✅ NEW
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

    /** The normal (base) process */
    private baseProcess: Match3Process;

    /** ⚠️ The active process (normal spin or free spin) */
    private _currentProcess: Match3Process;

    /** Public accessor for current process */
    public get process(): Match3Process {
        return this._currentProcess;
    }

    /** A dedicated free spin process */
    public freeSpinProcess: Match3FreeSpinProcess;

    /** ✅ NEW: A dedicated auto spin process */
    public autoSpinProcess: Match3AutoSpinProcess;

    /** Game callbacks */
    public onSpinStart?: () => void;
    public onFreeSpinTrigger?: () => void;

    public onFreeSpinStart?: (spins: number) => void;
    public onFreeSpinComplete?: (current: number, remaining: number) => void;
    public onFreeSpinRoundStart?: (current: number, remaining: number) => void;
    public onFreeSpinRoundComplete?: () => void;
    public onFreeSpinInitialBonusScatterComplete?: (spins: number) => void;

    public onAutoSpinStart?: (count: number) => void;
    public onAutoSpinComplete?: (current: number, remaining: number) => void;
    public onAutoSpinRoundStart?: (current: number, remaining: number) => void;
    public onAutoSpinRoundComplete?: () => void;

    public onProcessStart?: () => void;
    public onProcessComplete?: () => void | void;

    constructor() {
        super();
        this.spinning = false;

        /** Game sub-systems */
        this.config = slotGetConfig();
        this.stats = new Match3Stats(this);
        this.roundResults = new Match3RoundResults(this);
        this.board = new Match3Board(this);
        this.actions = new Match3Actions(this);

        /** Create process instances */
        this.baseProcess = new Match3Process(this);
        this._currentProcess = this.baseProcess; // start with normal process
        this.freeSpinProcess = new Match3FreeSpinProcess(this);
        this.autoSpinProcess = new Match3AutoSpinProcess(this);
        
    }

    /** Switch back to normal/base process */
    public useBaseProcess() {
        this._currentProcess = this.baseProcess;
    }

    /** Switch to free spin process */
    public useFreeSpinProcess() {
        this._currentProcess = this.freeSpinProcess;
    }

    /** ✅ NEW: Switch to auto spin process */
    public useAutoSpinProcess() {
        this._currentProcess = this.autoSpinProcess;
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
        this.stats.reset();

        // Reset all processes safely
        this.baseProcess.reset();
        this.freeSpinProcess.reset();

        /** ✅ NEW */
        this.autoSpinProcess.reset();

        this.useBaseProcess(); // ensure we go back to normal process after reset
    }

    /** Start normal spin */
    public async spin() {
        if (this.spinning) return;
        this.spinning = true;

        await this.actions.actionSpin();

        this.spinning = false;
    }

    public async freeSpinInitial(spins: number) {
        if (this.spinning) return;
        this.spinning = true;

        await this.actions.actionFreeSpinInitial(spins);

        this.spinning = false;
    }

    /** Start free spin sequence */
    public async freeSpin(spins: number) {
        if (this.spinning) return;
        this.spinning = true;

        await this.actions.actionFreeSpin(spins);

        this.spinning = false;
    }

    public async autoSpin(spins: number) {
        if (this.spinning) return;
        this.spinning = true;

        await this.actions.actionAutoSpin(spins);

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
        // this.board.pause();
        // this.process.pause();
    }

    /** Resume the game */
    public resume() {
        // this.board.resume();
        // this.process.resume();
    }

    /** Update the timer */
    public update(_delta: number) {
        // this.timer.update(delta);
        this.process.update(_delta); // <- will call base/free/auto depending on current process
    }
}
