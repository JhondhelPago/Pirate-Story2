import { Container, Sprite, Texture, Graphics } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

export interface BuyConfirmData {
    confirmationBoard: string;
    buySpinLabel: string;
    amountLabel: string;
    confirmButton: string;
    cancelButton: string;
}

export class ConfirmationBuyFreeSpinPopup extends Container {
    private panel!: Container;
    private bg!: Sprite;
    private board!: Sprite;

    private buyLabel!: Sprite;

    private amtBg!: Graphics;
    private amtLabel!: Sprite;
    private amtPulseTween?: gsap.core.Tween;

    private btnConfirm!: Sprite;
    private btnCancel!: Sprite;

    constructor() {
        super();
        this.eventMode = "static";
        this.interactiveChildren = true;
    }

    public prepare<T>(data?: T) {
        const d = data as BuyConfirmData;

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

        this.buyLabel = Sprite.from(d.buySpinLabel);
        this.buyLabel.anchor.set(0.5);
        this.board.addChild(this.buyLabel);

        this.amtBg = new Graphics();
        this.amtBg.alpha = 0.75;
        this.board.addChild(this.amtBg);

        this.amtLabel = Sprite.from(d.amountLabel);
        this.amtLabel.anchor.set(0.5);
        this.board.addChild(this.amtLabel);

        this.btnConfirm = Sprite.from(d.confirmButton);
        this.btnConfirm.anchor.set(0.5);
        this.btnConfirm.eventMode = "static";
        this.btnConfirm.cursor = "pointer";
        this.board.addChild(this.btnConfirm);
        this.btnConfirm.on("pointertap", () => this.hide());

        this.btnCancel = Sprite.from(d.cancelButton);
        this.btnCancel.anchor.set(0.5);
        this.btnCancel.eventMode = "static";
        this.btnCancel.cursor = "pointer";
        this.board.addChild(this.btnCancel);
        this.btnCancel.on("pointertap", () => this.hide());

        this.dropIn();
        this.startAmountPulse();
    }

    private dropIn() {
        const oy = this.board.y;
        this.board.alpha = 0;
        this.board.y = oy - 400;

        gsap.to(this.board, {
            alpha: 1,
            y: oy,
            duration: 0.35,
            ease: "back.out(1.4)"
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

        // ========== LABEL POSITION (FIXED) ==========
        if (isMobile) {
            this.buyLabel.y = -bh * 0.25; // CORRECTED - move downward
        } else {
            this.buyLabel.y = -bh * 0.30;
        }

        // Amount
        this.amtLabel.y = 0;

        const padX = bw * 0.18;
        const padY = bh * 0.05;

        const amtW = this.amtLabel.width + padX;
        const amtH = this.amtLabel.height + padY;

        this.amtBg.clear();
        this.amtBg.beginFill(0x000000, 0.6);
        this.amtBg.drawRoundedRect(
            -amtW * 0.5,
            -amtH * 0.5,
            amtW,
            amtH,
            40
        );
        this.amtBg.endFill();

        this.amtBg.x = this.amtLabel.x;
        this.amtBg.y = this.amtLabel.y;

        // Buttons
        if (isMobile) {
            this.btnConfirm.y = bh * 0.22;
            this.btnCancel.y = bh * 0.22;
        } else {
            this.btnConfirm.y = bh * 0.26;
            this.btnCancel.y = bh * 0.26;
        }

        let buttonOffset = bw * 0.23;   // desktop default

        if (isMobile) {
            buttonOffset = bw * 0.17;   // mobile: reduced gap
        }

        this.btnConfirm.x = -buttonOffset;
        this.btnCancel.x = buttonOffset;
    }

    private startAmountPulse() {
        gsap.killTweensOf(this.amtLabel.scale);

        this.amtPulseTween = gsap.to(this.amtLabel.scale, {
            x: 1.08,
            y: 1.08,
            duration: 1.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
    }

    private stopAmountPulse() {
        this.amtPulseTween?.kill();
        gsap.to(this.amtLabel.scale, { x: 1, y: 1, duration: 0.2 });
    }

    public async hide() {
        this.stopAmountPulse();

        gsap.to([this.board, this.bg], {
            alpha: 0,
            duration: 0.2
        });

        setTimeout(() => navigation.dismissPopup(), 200);
    }
}
