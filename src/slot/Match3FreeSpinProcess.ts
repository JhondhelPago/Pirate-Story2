import { Match3 } from "./Match3";
import { Match3Process } from "./Match3Process";
import { RoundResult, slotEvaluateClusterWins } from "./SlotUtility";
import { waitFor } from "../utils/asyncUtils";
import { SpinRoundBanner } from "../ui/SpinRoundBanner";
import { navigation } from "../utils/navigation";

export class Match3FreeSpinProcess extends Match3Process {

    protected roundWin = 0;
    protected remainingFreeSpin = 0;
    protected currentFreeSpin = 0;

    constructor(match3: Match3) {
        super(match3);
    }

    // Start free spins
    public async start(freeSpins: number = 0) {
        this.remainingFreeSpin = freeSpins;
        this.currentFreeSpin = 0;

        console.log("Free Spin Started:", freeSpins);
        await this.runNextSpin();
    }

    public async startUninterrupted() {

        if (this.isBannerDraw){
            SpinRoundBanner.forceDismiss();
        }

        if (this.processing) return;

        this.stopAllClusterAnimations();
        this.processing = true;

        this.match3.board.removeInitialPiecesOnly();
        await this.spinSequence();

        this.processing = false;
        this.match3.onProcessComplete?.();
    }

    private async runNextSpin() {
        if (this.remainingFreeSpin <= 0) {
            console.log("Free Spins Complete.");
            return;
        }
        
        console.log("Free Spins Remaining:", this.remainingFreeSpin);
        console.log("IsProcessing:", this.processing);
        // consume one spin
        this.remainingFreeSpin--;
        this.currentFreeSpin++;

        // ---- RUN PARENT SPIN ----
        await this.startUninterrupted();

        if (this.hasRoundWin) {
            if (this.isBannerDraw){
                await waitFor(7);
            } else {
                await waitFor(3);
            }
        } else {
            await waitFor(1.5);
        }

        await this.runNextSpin();
    }

    public startSpinLog() {
        console.log("Spin Session from the Match3FreeSpinProcess");
    }
}
