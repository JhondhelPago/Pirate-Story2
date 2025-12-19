import { Container, Sprite, Texture, Graphics, Text, Matrix } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

export interface BuyConfirmData {
    confirmationBoard: string;

    // ✅ NEW: dynamic spins for "BUY {SPINS} FREE SPINS"
    spins: number;

    // ✅ amount (still numeric)
    amount: number;

    // ✅ optional formatting for amount
    currencySymbol?: string; // default "$"
    decimals?: number; // default 2

    confirmButton: string;
    cancelButton: string;

    onConfirm?: () => void;
}

export class ConfirmationBuyFreeSpinPopup extends Container {
    private panel!: Container;
    private bg!: Sprite;
    private board!: Sprite;

    // ✅ NEW: text label container (replaces sprite label)
    private buyLabelContainer?: Container;
    private buyPrefixText?: Text;
    private buyNumberText?: Text;
    private buySuffixText?: Text;

    private amtBg!: Graphics;

    // ✅ Text amount (Pirata One gradient)
    private valueText?: Text;
    private amtPulseTween?: gsap.core.Tween;

    private btnConfirm!: Sprite;
    private btnCancel!: Sprite;

    private onConfirm?: () => void;

    // formatting prefs
    private currencySymbol = "$";
    private decimals = 2;

    // ✅ shared gradient for label + amount (same look)
    private static labelGradientTexture?: Texture;
    private static labelGradientMatrix?: Matrix;

    constructor() {
        super();
        this.eventMode = "static";
        this.interactiveChildren = true;
    }

    public prepare<T>(data?: T) {
        const d = data as BuyConfirmData;
        this.onConfirm = d.onConfirm;

        this.currencySymbol = d.currencySymbol ?? "$";
        this.decimals = d.decimals ?? 2;

        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = "static";
        this.addChild(this.bg);

        this.bg.on("pointertap", () => this.hide());

        this.panel = new Container();
        this.addChild(this.panel);

        this.board = Sprite.from(d.confirmationBoard);
        this.board.anchor.set(0.5);
        this.panel.addChild(this.board);

        // ✅ build "BUY {SPINS} FREE SPINS" (Pirata One + gradient, number plain white)
        this.createBuyLabel(d.spins);

        this.amtBg = new Graphics();
        this.amtBg.alpha = 0.75;
        this.board.addChild(this.amtBg);

        // ✅ build the amount text (Pirata One gradient)
        this.createValueText(this.formatAmount(d.amount));

        this.btnConfirm = Sprite.from(d.confirmButton);
        this.btnConfirm.anchor.set(0.5);
        this.btnConfirm.eventMode = "static";
        this.btnConfirm.cursor = "pointer";
        this.board.addChild(this.btnConfirm);
        this.btnConfirm.on("pointertap", () => {
            this.onConfirm?.();
            this.hide();
        });

        this.btnCancel = Sprite.from(d.cancelButton);
        this.btnCancel.anchor.set(0.5);
        this.btnCancel.eventMode = "static";
        this.btnCancel.cursor = "pointer";
        this.board.addChild(this.btnCancel);
        this.btnCancel.on("pointertap", () => this.hide());

        this.dropIn();
        this.startAmountPulse();
    }

    // ✅ if you need to update amount later
    public setAmount(amount: number) {
        if (!this.valueText) {
            this.createValueText(this.formatAmount(amount));
        } else {
            this.valueText.text = this.formatAmount(amount);
        }
        this.updateAmountBg();
    }

    // ✅ optional: update the spins label later
    public setSpins(spins: number) {
        this.createBuyLabel(spins);
    }

    private formatAmount(amount: number): string {
        const n = Number.isFinite(amount) ? amount : 0;

        const formatted = new Intl.NumberFormat("en-US", {
            minimumFractionDigits: this.decimals,
            maximumFractionDigits: this.decimals,
        }).format(n);

        return `${this.currencySymbol}${formatted}`;
    }

    // -------------------------
    // ✅ BUY LABEL (TEXT)
    // -------------------------

    private ensureLabelGradient() {
        if (
            ConfirmationBuyFreeSpinPopup.labelGradientTexture &&
            ConfirmationBuyFreeSpinPopup.labelGradientMatrix
        ) {
            return;
        }

        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;

        const ctx = gradientCanvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);

        // same palette you already use
        gradient.addColorStop(0.0, "#FFF39C");
        gradient.addColorStop(0.19, "#FFF39C");
        gradient.addColorStop(0.34, "#FDD44F");
        gradient.addColorStop(0.51, "#FDD44F");
        gradient.addColorStop(1.0, "#D79600");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        ConfirmationBuyFreeSpinPopup.labelGradientTexture = Texture.from(gradientCanvas);

        const mat = new Matrix();
        mat.scale(1 / gradientCanvas.width, 1 / gradientCanvas.height);
        ConfirmationBuyFreeSpinPopup.labelGradientMatrix = mat;
    }

    private createBuyLabel(spins: number) {
        // clean previous
        if (this.buyLabelContainer) {
            this.buyLabelContainer.destroy({ children: true });
            this.buyLabelContainer = undefined;
            this.buyPrefixText = undefined;
            this.buyNumberText = undefined;
            this.buySuffixText = undefined;
        }

        this.ensureLabelGradient();

        const tex = ConfirmationBuyFreeSpinPopup.labelGradientTexture!;
        const mat = ConfirmationBuyFreeSpinPopup.labelGradientMatrix!;

        const container = new Container();
        container.eventMode = "none";

        const stroke = { color: 0x4c1b05, width: 6 };

        // You can tweak this if the board is tight
        const fontSize = 92;

        const prefix = new Text("BUY ", {
            fontFamily: "Pirata One",
            fontSize,
            align: "center",
            fill: { texture: tex, matrix: mat },
            stroke,
        });
        prefix.anchor.set(0, 0.5);

        const number = new Text(String(spins), {
            fontFamily: "Pirata One",
            fontSize,
            align: "center",
            fill: 0xffffff, // ✅ plain white, no gradient
            stroke,
        });
        number.anchor.set(0, 0.5);

        const suffix = new Text(" FREE SPINS", {
            fontFamily: "Pirata One",
            fontSize,
            align: "center",
            fill: { texture: tex, matrix: mat },
            stroke,
        });
        suffix.anchor.set(0, 0.5);

        container.addChild(prefix, number, suffix);

        // lay out horizontally, then center the whole container
        prefix.x = 0;
        number.x = prefix.x + prefix.width;
        suffix.x = number.x + number.width;

        const totalW = prefix.width + number.width + suffix.width;
        container.pivot.set(totalW * 0.5, 0);

        // same behavior as old label: centered on board
        container.x = 0;
        container.y = 0;

        this.board.addChild(container);

        this.buyLabelContainer = container;
        this.buyPrefixText = prefix;
        this.buyNumberText = number;
        this.buySuffixText = suffix;
    }

    // -------------------------
    // ✅ AMOUNT (TEXT)
    // -------------------------

    private createValueText(initialText: string) {
        if (this.valueText) {
            this.valueText.destroy();
            this.valueText = undefined;
        }

        // reuse same gradient look
        this.ensureLabelGradient();
        const gradientTexture = ConfirmationBuyFreeSpinPopup.labelGradientTexture!;
        const mat = ConfirmationBuyFreeSpinPopup.labelGradientMatrix!;

        this.valueText = new Text(initialText, {
            fontFamily: "Pirata One",
            fontSize: 150,
            align: "center",
            fill: {
                texture: gradientTexture,
                matrix: mat,
            },
            stroke: {
                color: 0x4c1b05,
                width: 6,
            },
        });

        this.valueText.anchor.set(0.5);

        this.valueText.x = 0;
        this.valueText.y = 0;

        this.board.addChild(this.valueText);

        this.updateAmountBg();
    }

    private updateAmountBg() {
        if (!this.valueText) return;

        const bw = this.board.width;
        const bh = this.board.height;

        const padX = bw * 0.18;
        const padY = bh * 0.05;

        const amtW = this.valueText.width + padX;
        const amtH = this.valueText.height + padY;

        this.amtBg.clear();
        this.amtBg.beginFill(0x000000, 0.6);
        this.amtBg.drawRoundedRect(-amtW * 0.5, -amtH * 0.5, amtW, amtH, 40);
        this.amtBg.endFill();

        this.amtBg.x = this.valueText.x;
        this.amtBg.y = this.valueText.y;
    }

    private dropIn() {
        const oy = this.board.y;
        this.board.alpha = 0;
        this.board.y = oy - 400;

        gsap.to(this.board, {
            alpha: 1,
            y: oy,
            duration: 0.35,
            ease: "back.out(1.4)",
        });
    }

    public resize(width: number, height: number) {
        const isMobile = height > width;

        this.bg.width = width;
        this.bg.height = height;

        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        this.board.scale.set(isMobile ? 1.2 : 1);

        const bw = this.board.width;
        const bh = this.board.height;

        // ✅ label position (replaces old sprite label y)
        if (this.buyLabelContainer) {
            this.buyLabelContainer.y = isMobile ? -bh * 0.25 : -bh * 0.3;
            this.buyLabelContainer.x = 0;
        }

        if (this.valueText) {
            this.valueText.y = 0;
        }

        this.updateAmountBg();

        if (isMobile) {
            this.btnConfirm.y = bh * 0.22;
            this.btnCancel.y = bh * 0.22;
        } else {
            this.btnConfirm.y = bh * 0.26;
            this.btnCancel.y = bh * 0.26;
        }

        let buttonOffset = bw * 0.23;
        if (isMobile) buttonOffset = bw * 0.17;

        this.btnConfirm.x = -buttonOffset;
        this.btnCancel.x = buttonOffset;
    }

    private startAmountPulse() {
        if (!this.valueText) return;

        gsap.killTweensOf(this.valueText.scale);

        this.amtPulseTween = gsap.to(this.valueText.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });
    }

    private stopAmountPulse() {
        if (!this.valueText) return;

        this.amtPulseTween?.kill();
        gsap.to(this.valueText.scale, { x: 1, y: 1, duration: 0.2 });
    }

    public async hide() {
        this.stopAmountPulse();

        gsap.to([this.board, this.bg], {
            alpha: 0,
            duration: 0.2,
        });

        // browser setTimeout returns number
        window.setTimeout(() => navigation.dismissPopup(), 200);
    }
}
