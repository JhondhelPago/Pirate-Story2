import { Match3 } from './Match3';

export class Match3Actions {
    public match3: Match3;
    public freeMoves = false;

    constructor(match3: Match3) {
        this.match3 = match3;
    }

    public async actionSpin() {
        this.match3.useBaseProcess();
        this.match3.onSpinStart?.();
        await this.match3.process.start();
    }

    public async actionFreeSpinInitial() {
        this.match3.useFreeSpinProcess();
        this.match3.freeSpinProcess.freeSpinStartInitialBonus();
    }

    public async actionFreeSpin(spins: number) {
        this.match3.useFreeSpinProcess();
        this.match3.freeSpinProcess.setSpins(spins);
        await this.match3.freeSpinProcess.freeSpinStart();
    }

    public async actionAutoSpin(spins: number){
        this.match3.useAutoSpinProcess();
        this.match3.autoSpinProcess.setSpins(spins);
        await this.match3.autoSpinProcess.autoSpinStart();        
    }
    
    public setup(config: { isFreeSpin: boolean }) {
        this.freeMoves = config.isFreeSpin;
    }
}
