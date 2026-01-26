import { Slot } from './Slot';

export class SlotActions {
    public match3: Slot;
    public freeMoves = false;

    constructor(match3: Slot) {
        this.match3 = match3;
    }

    public async actionSpin() {
        this.match3.useBaseProcess();
        this.match3.onSpinStart?.();
        await this.match3.process.start();
    }

    public async actionFreeSpinInitial(spins: number) {
        this.match3.useFreeSpinProcess();
        this.match3.freeSpinProcess.setSpinRounds(spins);
        this.match3.freeSpinProcess.freeSpinStartInitialBonus();
    }

    public async actionFreeSpin(spins: number) {
        this.match3.useFreeSpinProcess();
        this.match3.freeSpinProcess.setSpins(spins);
        await this.match3.freeSpinProcess.freeSpinStart();
    }

    public async actionAutoSpin(spins: number) {
        this.match3.useAutoSpinProcess();
        this.match3.autoSpinProcess.setSpins(spins);
        await this.match3.autoSpinProcess.autoSpinStart();
    }

    public setup(config: { isFreeSpin: boolean }) {
        this.freeMoves = config.isFreeSpin;
    }
}
