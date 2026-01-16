import { Container } from 'pixi.js';
import { Match3Actions } from './Match3Actions';
import { Match3Board } from './Match3Board';
import { Match3Config, slotGetConfig } from './Match3Config';
import { Match3Process } from './Match3Process';
import { Match3Stats } from './Match3Stats';
import { Match3FreeSpinProcess } from './Match3FreeSpinProcess';
import { Match3AutoSpinProcess } from './Match3AutoSpinProcess';
import { SlotSymbol } from './SlotSymbol';
import { Match3RoundResults } from './Match3RounResults';
import { gameConfig } from '../utils/gameConfig';
import { waitFor } from '../utils/asyncUtils';

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

    // ✅ IMPORTANT: make this awaitable so controller interrupt doesn't end early
    public onFreeSpinComplete?: (current: number, remaining: number) => Promise<void> | void;

    public onFreeSpinRoundStart?: (current: number, remaining: number) => void;
    public onFreeSpinRoundComplete?: () => void;

    public onFreeSpinInitialBonusScatterComplete?: (spins: number) => Promise<void> | void;

    public onAutoSpinStart?: (count: number) => void;
    public onAutoSpinComplete?: (current: number, remaining: number) => void;
    public onAutoSpinRoundStart?: (current: number, remaining: number) => void;
    public onAutoSpinRoundComplete?: () => void;

    // ✅ already used as awaited in switchToFreeSpin
    public onAutoSpinWonToFreeSpin?: (spins: number) => Promise<void> | void;

    public onProcessStart?: () => void;
    public onProcessComplete?: () => Promise<void> | void;

    // ---------------------------------------------------------------------
    // ✅ Central process orchestration (interrupt + resume)
    // ---------------------------------------------------------------------

    /**
     * Stack of paused processes (supports nested interrupts).
     * Example: AutoSpin -> FreeSpin -> Jackpot -> back to FreeSpin -> back to AutoSpin
     */
    private processStack: Match3Process[] = [];

    /**
     * Serialize controller operations so process switches can't race each other.
     * (e.g., two interrupts triggered close together)
     */
    private controllerChain: Promise<void> = Promise.resolve();

    /** Guard to prevent re-entrant begin/end interrupt misuse */
    private switching = false;

    /**
     * ✅ NEW: controller-level guard (separate from this.spinning)
     * - this.spinning is for user/public entry points (spin/freeSpin/autoSpin)
     * - controllerBusy is for internal interrupt orchestration
     */
    private controllerBusy = false;

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

    // ---------------------------------------------------------------------
    // ✅ Controller queue helper
    // ---------------------------------------------------------------------

    /**
     * Enqueue an operation to run exclusively (one-at-a-time).
     * Prevents switch races from multiple interrupts.
     */
    private runControllerTask(task: () => Promise<void>): Promise<void> {
        this.controllerChain = this.controllerChain.then(task).catch((err) => {
            // Don't break the chain permanently
            console.error('[Match3 Controller Task Error]', err);
        });

        return this.controllerChain;
    }

    // ---------------------------------------------------------------------
    // ✅ Interrupt primitives (stack-based)
    // ---------------------------------------------------------------------

    /**
     * Pause current process and push it to stack, then switch to target.
     * NOTE: This does NOT start the target process; it only switches control.
     */
    private async beginInterrupt(target: Match3Process) {
        if (this.switching) return;
        this.switching = true;

        const current = this._currentProcess;

        // If target is already current, nothing to do.
        if (current === target) {
            this.switching = false;
            return;
        }

        // Pause current process safely
        try {
            current.interruptSpinDelay?.();
        } catch {}
        try {
            current.pause?.();
        } catch {}

        // Push paused process for later resume
        this.processStack.push(current);

        // Switch active process reference
        if (target === this.baseProcess) this.useBaseProcess();
        else if (target === this.freeSpinProcess) this.useFreeSpinProcess();
        else if (target === this.autoSpinProcess) this.useAutoSpinProcess();
        else this._currentProcess = target;

        this.switching = false;
    }

    /**
     * End an interrupt: restore previous process (if any) and resume it.
     */
    private async endInterrupt() {
        if (this.switching) return;
        this.switching = true;

        const prev = this.processStack.pop();
        if (!prev) {
            this.switching = false;
            return;
        }

        // Switch back
        if (prev === this.baseProcess) this.useBaseProcess();
        else if (prev === this.freeSpinProcess) this.useFreeSpinProcess();
        else if (prev === this.autoSpinProcess) this.useAutoSpinProcess();
        else this._currentProcess = prev;

        // Resume the restored process
        try {
            prev.resume?.();
        } catch {}

        this.switching = false;
    }

    /**
     * Utility: perform an interrupt flow:
     * - pause/push current
     * - switch to target
     * - run async work
     * - restore previous
     */
    private async interruptWith(target: Match3Process, work: () => Promise<void>) {
        await this.beginInterrupt(target);
        try {
            await work();
        } finally {
            await this.endInterrupt();
        }
    }

    public async switchToFreeSpin(spins: number, opts?: { initial?: boolean }) {
        return this.runControllerTask(async () => {
            if (this.controllerBusy) return;
            this.controllerBusy = true;

            try {
                await this.interruptWith(this.freeSpinProcess, async () => {
                    if (opts?.initial) {
                        // trigger the free spin with the initial spin with bonus
                        await this.actions.actionFreeSpinInitial(spins);
                    } else {
                        // ✅ trigger GameScreen hook (draw banner and wait close)
                        await this.onAutoSpinWonToFreeSpin?.(spins);

                        await this.actions.actionFreeSpin(spins);
                    }
                });
            } finally {
                this.controllerBusy = false;
            }
        });
    }

    public async swtichToAutoSpin(spins: number) {
        return this.runControllerTask(async () => {
            if (this.controllerBusy) return;
            this.controllerBusy = true;

            try {
                await this.interruptWith(this.autoSpinProcess, async () => {
                    await this.actions.actionAutoSpin(spins);
                });
            } finally {
                this.controllerBusy = false;
            }
        });
    }

    public async swtichToProcess(process: Match3Process, work: () => Promise<void>) {
        return this.runControllerTask(async () => {
            if (this.controllerBusy) return;
            this.controllerBusy = true;

            try {
                await this.interruptWith(process, work);
            } finally {
                this.controllerBusy = false;
            }
        });
    }

    // ---------------------------------------------------------------------
    // Existing lifecycle
    // ---------------------------------------------------------------------

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
        this.autoSpinProcess.reset();

        // Clear orchestration state
        this.processStack = [];
        this.switching = false;
        this.controllerBusy = false;
        this.controllerChain = Promise.resolve();

        this.useBaseProcess(); // ensure we go back to normal process after reset
        this.spinning = false;
    }

    /** Start normal spin */
    public async spin() {
        // ✅ Block public actions during controller interrupts too
        if (this.spinning || this.controllerBusy) return;
        this.spinning = true;

        await this.actions.actionSpin();

        this.spinning = false;
    }

    public async freeSpinInitial(spins: number, featureCode: number) {
        if (this.spinning || this.controllerBusy) return;
        this.spinning = true;

        this.freeSpinProcess.setFeatureCode(featureCode);

        await this.actions.actionFreeSpinInitial(spins);

        this.spinning = false;
    }

    /** Start free spin sequence */
    public async freeSpin(spins: number) {
        if (this.spinning || this.controllerBusy) return;
        this.spinning = true;

        await this.actions.actionFreeSpin(spins);

        this.spinning = false;
    }

    public async autoSpin(spins: number) {
        if (this.spinning || this.controllerBusy) return;
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
        this.process.pause?.();
    }

    /** Resume the game */
    public resume() {
        this.process.resume?.();
    }

    /** Update the timer */
    public update(_delta: number) {
        this.process.update(_delta);
    }

    public getStackSize() {
        return this.processStack.length;
    }
}
