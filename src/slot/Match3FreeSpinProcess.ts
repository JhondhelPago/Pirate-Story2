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

        // Parent banner: if banner appears, it blocks next spin until user click or auto hide
        // So we don't need to manage it — parent already delays internally.

        // ---- RECURSIVE NEXT SPIN ----
        await this.runNextSpin();
    }

    // Override to add a delay for the free spin session
    // protected async DrawSpinRoundBanner(roundResult: RoundResult) {
    //     const totalFinalWin = roundResult.reduce((sum, r) => sum + r.finalWin, 0);

    //     if (totalFinalWin < 50) return;

    //     await new Promise(res => setTimeout(res, 2000));

    //     if (this.processing) return;

    //     const banner = navigation.presentPopup(SpinRoundBanner, { win: totalFinalWin });
    // }

    public startSpinLog() {
        console.log("Spin Session from the Match3FreeSpinProcess");
    }
}
