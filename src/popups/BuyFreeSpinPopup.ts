import { Container, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { navigation } from '../utils/navigation';
import { ConfirmationBuyFreeSpinPopup } from './BuyFreeConfirmationPopup';
import { GameScreen } from '../screens/GameScreen';

export class BuyFreeSpinPopup extends Container {
    private bg: Sprite;
    private panel: Container;

    private buyLabel: Sprite;
    private option10: Sprite;
    private option15: Sprite;
    private option20: Sprite;

    private exitButton: Sprite;

    private canClickAnywhere = false;
    private onSelect?: (value: number) => void;

    private pulseTween?: gsap.core.Tween;

    constructor() {
        super();
        this.eventMode = 'static';
        this.interactiveChildren = true;

        // Background overlay
        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = 'static';
        this.addChild(this.bg);

        // Panel container
        this.panel = new Container();
        this.addChild(this.panel);

        // Label
        this.buyLabel = Sprite.from('buy-free-spin-label');
        this.buyLabel.anchor.set(0.5);
        this.panel.addChild(this.buyLabel);

        // Options
        this.option10 = Sprite.from('10-spin-banner');
        this.option15 = Sprite.from('15-spin-banner');
        this.option20 = Sprite.from('20-spin-banner');

        const optionList = [this.option10, this.option15, this.option20];
        for (const s of optionList) {
            s.anchor.set(0.5);
            s.eventMode = 'static';
            s.cursor = 'pointer';
            this.panel.addChild(s);

            // Hover
            s.on('pointerover', () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, { x: 1.08, y: 1.08, duration: 0.15 });
            });
            s.on('pointerout', () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, { x: 1, y: 1, duration: 0.15 });
            });

            // Tap pop
            s.on('pointertap', () => {
                gsap.killTweensOf(s.scale);
                gsap.to(s.scale, {
                    x: 1.2,
                    y: 1.2,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                });

                // =====================================================
                // 🔥 ADD TRIGGER TO OPEN CONFIRMATION POPUP
                // =====================================================
                if (s === this.option10) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-10-label",
                        amountLabel: "amount-200",
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            // process here to validate purchase, deduct currency,
                            game.freeSpinStartSpinning(2); 
                        }
                    });

                }
                else if (s === this.option15) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-15-label",
                        amountLabel: "amount-500",
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            // process here to validate purchase, deduct currency,
                            game.freeSpinStartSpinning(15); 
                        }
                    });
                }
                else if (s === this.option20) {
                    navigation.presentPopup(ConfirmationBuyFreeSpinPopup, {
                        confirmationBoard: "buy-spin-confirm-board",
                        buySpinLabel: "buy-20-label",
                        amountLabel: "amount-1000",
                        confirmButton: "confirm-button",
                        cancelButton: "cancel-button",
                        onConfirm: () => {
                            const game = navigation.currentScreen as GameScreen;
                            // process here to validate purchase, deduct currency,
                            game.freeSpinStartSpinning(20); 
                        }
                    });
                }
                // =====================================================
            });
        }

        // Clicking background closes
        this.bg.on('pointertap', () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        // =====================
        // EXIT BUTTON
        // =====================
        this.exitButton = Sprite.from('cancel-button'); // <-- replace with your asset
        this.exitButton.anchor.set(0.5);
        this.exitButton.scale.set(1.3);
        this.exitButton.eventMode = 'static';
        this.exitButton.cursor = 'pointer';
        this.addChild(this.exitButton);

        this.exitButton.on('pointerover', () => {
            gsap.to(this.exitButton.scale, { x: 1.1, y: 1.1, duration: 0.15 });
        });
        this.exitButton.on('pointerout', () => {
            gsap.to(this.exitButton.scale, { x: 1, y: 1, duration: 0.15 });
        });
        this.exitButton.on('pointertap', () => {
            gsap.to(this.exitButton.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.1,
                yoyo: true,
                repeat: 1,
            });
            this.hide();
        });
    }

    // ================================
    // LABEL PULSE
    // ================================
    private startLabelPulse() {
        gsap.killTweensOf(this.buyLabel.scale);

        this.pulseTween = gsap.to(this.buyLabel.scale, {
            x: 1.05,
            y: 1.05,
            duration: 1.2,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
        });
    }

    private stopLabelPulse() {
        this.pulseTween?.kill();
        gsap.to(this.buyLabel.scale, { x: 1, y: 1, duration: 0.2 });
    }

    // ============================================
    // ✨ NEW: REAL TOP-DROP ANIMATION (ALWAYS TOP)
    // ============================================
    private animateEntrance() {
        const options = [this.option10, this.option15, this.option20];

        options.forEach((opt, index) => {
            gsap.killTweensOf(opt);

            const finalY = opt.y;
            opt.alpha = 0;

            // FORCE start above screen no matter what layout is
            opt.y = finalY - 900;

            gsap.to(opt, {
                alpha: 1,
                y: finalY,
                duration: 0.7,
                delay: index * 0.12,
                ease: "bounce.out",
            });
        });
    }

    public prepare<T>(data?: T) {
        const anyData = data as any;
        if (anyData?.onSelect) this.onSelect = anyData.onSelect;

        this.canClickAnywhere = false;

        this.startLabelPulse();
        this.animateEntrance();

        setTimeout(() => (this.canClickAnywhere = true), 500);
    }

    // ================================
    // LAYOUT
    // ================================
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        const isMobile = height > width;

        // PANEL POSITION
        this.panel.x = width * 0.5;
        this.panel.y = isMobile ? height * 0.46 : height * 0.45;

        // ============================
        // FIXED EXIT BUTTON FOR MOBILE
        // ============================
        if (isMobile) {
            this.exitButton.x = width * 0.88;

            const panelGlobalY = this.panel.y;
            const labelScreenY = panelGlobalY + this.buyLabel.y * this.panel.scale.y;

            this.exitButton.y = labelScreenY - 320;

            this.exitButton.scale.set(1.5);
        } else {
            this.exitButton.x = width * 0.90;
            this.exitButton.y = height * 0.12;
            this.exitButton.scale.set(1.3);
        }

        // ============================
        // FIXED LABEL SPACING ON MOBILE
        // ============================
        if (isMobile) {
            this.buyLabel.y = -480;
            this.buyLabel.scale.set(1.35);
        } else {
            this.buyLabel.y = -340;
            this.buyLabel.scale.set(1);
        }
        this.buyLabel.x = 0;

        // PANEL SCALE FOR MOBILE
        if (isMobile) {
            const targetWidth = width * 0.95;
            const bannersWidth = 500 * 3;
            const scale = targetWidth / bannersWidth;
            this.panel.scale.set(scale);
        } else {
            this.panel.scale.set(1);
        }

        // OPTION POSITIONS
        const spacing = 550;
        const bannerY = isMobile ? 120 : 40;

        if (isMobile) {
            this.option10.scale.set(1.25);
            this.option15.scale.set(1.25);
            this.option20.scale.set(1.25);
        } else {
            this.option10.scale.set(1);
            this.option15.scale.set(1);
            this.option20.scale.set(1);
        }

        this.option10.x = -spacing;
        this.option15.x = 0;
        this.option20.x = spacing;

        this.option10.y = bannerY;
        this.option15.y = bannerY;
        this.option20.y = bannerY;
    }

    public async hide() {
        this.canClickAnywhere = false;
        this.stopLabelPulse();

        const tl = gsap.timeline();
        tl.to(this.panel, { alpha: 0, duration: 0.2 });
        tl.to(this.bg, { alpha: 0, duration: 0.2 }, 0);

        await tl;
        await navigation.dismissPopup();
    }
}
