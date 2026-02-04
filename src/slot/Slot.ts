import { Container } from 'pixi.js';
import { SlotActions } from './SlotActions';
import { SlotBoard } from './SlotBoard';
import { SlotConfig, slotGetConfig } from './SlotConfig';
import { SlotProcess } from './SlotProcess';
import { SlotFreeSpinProcess } from './SlotFreeSpinProcess';
import { SlotAutoSpinProcess } from './SlotAutoSpinProcess';
import { SlotSymbol } from './SlotSymbol';
import { waitFor } from '../utils/asyncUtils';
import { userSettings } from '../utils/userSettings';

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
export class Slot extends Container {
    /** State if spinning */
    public spinning: boolean;

    /** Match3 game basic configuration */
    public config: SlotConfig;
    /** Display number of matches */
    /** Holds the grid state and display */
    public board: SlotBoard;
    /** Sort out actions that the player can take */
    public actions: SlotActions;

    /** The normal (base) process */
    private baseProcess: SlotProcess;

    /** ⚠️ The active process (normal spin or free spin) */
    private _currentProcess: SlotProcess;

    /** Public accessor for current process */
    public get process(): SlotProcess {
        return this._currentProcess;
    }

    /** A dedicated free spin process */
    public freeSpinProcess: SlotFreeSpinProcess;

    /** ✅ NEW: A dedicated auto spin process */
    public autoSpinProcess: SlotAutoSpinProcess;

    /** Game callbacks */
    public onSpinStart?: () => void;
    public onFreeSpinTrigger?: () => void;

    public onFreeSpinStart?: (spins: number) => void;

    // ✅ IMPORTANT: make this awaitable so controller interrupt doesn't end early
    public onFreeSpinComplete?: (current: number, remaining: number) => Promise<void> | void;

    public onFreeSpinRoundStart?: (current: number, remaining: number) => void;
    public onFreeSpinRoundComplete?: () => void;
    public onFreeSpinInitialBonusScatterComplete?: (spins: number) => Promise<void> | void;
    public onFreeSpinResumeStart?: (spins: number) => Promise<void>;

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
    private processStack: SlotProcess[] = [];

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
        this.board = new SlotBoard(this);
        this.actions = new SlotActions(this);

        /** Create process instances */
        this.baseProcess = new SlotProcess(this);
        this._currentProcess = this.baseProcess; // start with normal process
        this.freeSpinProcess = new SlotFreeSpinProcess(this);
        this.autoSpinProcess = new SlotAutoSpinProcess(this);
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
    private async beginInterrupt(target: SlotProcess) {
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
        } catch {
            // do nothing
        }
        try {
            current.pause?.();
        } catch {
            // do nothing
        }

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

        await userSettings.setupCollect(); // fresh spin index and collect balance setter --- IGNORE ---

        // Resume the restored process
        try {
            prev.resume?.();
        } catch {
            // do nothing
        }

        this.switching = false;
    }

    /**
     * Utility: perform an interrupt flow:
     * - pause/push current
     * - switch to target
     * - run async work
     * - restore previous
     */
    private async interruptWith(target: SlotProcess, work: () => Promise<void>) {
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

    public async swtichToProcess(process: SlotProcess, work: () => Promise<void>) {
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

    public isBaseProcess() {
        return this._currentProcess === this.baseProcess;
    }

    public isAutoSpinProcess() {
        return this._currentProcess === this.autoSpinProcess;
    }

    public isFreeSpinProcess() {
        return this._currentProcess === this.freeSpinProcess;
    }

    /**
     * True if ANY process is running, paused, queued, or switching
     */
    public hasPendingProcess(): boolean {
        return this.spinning || this.controllerBusy || this.switching || this.processStack.length > 0;
    }

    // ---------------------------------------------------------------------
    // Existing lifecycle
    // ---------------------------------------------------------------------

    /**
     * Sets up a new match3 game with pieces, rows, columns, duration, etc.
     * @param config The config object in which the game will be based on
     */
    public async setup(config: SlotConfig) {
        this.config = config;
        this.reset();

        // need to have a checker her if the resume type specific setup is fo the normal spin, or free spin
        const ResumeData = userSettings.getResumeData();

        //resumeType of not equal 2 is non free spin resume
        if (ResumeData.resumeType != 2) {
            // setting up the board from resume of NonFreeSpin

            await this.process.resumeStart();
            this.board.setup(config);
        } else {
            // setting up the board from resume of FreeSpin
            // lock interactions here
            await this.onFreeSpinResumeStart?.(ResumeData.spins);

            this.useFreeSpinProcess();
            this.board.applyBackendResults(ResumeData.reels, ResumeData.multiplierReels);
            this.board.setup(config);
            await waitFor(2);
            this.spinning = true;
            await this.process.resumeStart();
        }
    }

    /** Fully reset the game */
    public reset() {
        this.interactiveChildren = false;

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
