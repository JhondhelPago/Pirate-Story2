import { Match3 } from './Match3';
import gsap from 'gsap';

/** Interface for actions configuration */
interface Match3ActionsConfig {
    isFreeSpin: boolean;
}

/**
 * These are the actions player can take: move pieces (swap) or tap if they are special.
 * Action effects happens instantly, and the game will deal with whatever state the grid ends up with.
 */
export class Match3Actions {
    /** The match3 instance */
    public match3: Match3;

    /** Free all moves, meaning that they will always be valid regardles of matching results */
    public freeMoves = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public async actionSpin() {
        this.match3.onSpinStart?.();

        await this.match3.board.fallToBottomGrid();
        this.match3.board.reset();

        await this.match3.board.fillGrid();
        this.match3.process.start();
    }

    public async actionFreeSpin() {
        this.match3.freeSpinProcess.start(5);
    }

    /**
     * Set up actions with given configuration
     * @param config Actions config params
     */
    public setup(config: Match3ActionsConfig) {
        this.freeMoves = config.isFreeSpin;
    }
}
