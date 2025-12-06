import { Container, Sprite, Texture } from "pixi.js";
import gsap from "gsap";
import { navigation } from "../utils/navigation";

export class SpinRoundBanner extends Container {
    private bg: Sprite;
    private panel: Container;

    private banner!: Sprite;
    private headerText!: Sprite;

    private winValue: number = 0;
    private canClickAnywhere = false;

    // ⭐ Easily adjust the header position under the skull
    private readonly HEADER_OFFSET_Y = -180; // move up/down
    private readonly HEADER_OFFSET_X = 20;    // move left/right

    constructor() {
        super();
        this.eventMode = "static";
        this.interactiveChildren = true;

        // ==================================================
        // BACKGROUND OVERLAY
        // ==================================================
        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint = 0x000000;
        this.bg.alpha = 0.75;
        this.bg.eventMode = "static";
        this.addChild(this.bg);

        // Close popup when clicking outside
        this.bg.on("pointertap", () => {
            if (!this.canClickAnywhere) return;
            this.hide();
        });

        // ==================================================
        // CENTERED PANEL
        // ==================================================
        this.panel = new Container();
        this.addChild(this.panel);
    }

    // ==================================================
    // PREPARE POPUP
    // ==================================================
    public prepare<T>(data?: T) {
        const anyData = data as any;
        this.winValue = anyData?.win ?? 0;

        this.createBanner();
        this.createHeaderText();

        this.animateEntrance();

        setTimeout(() => (this.canClickAnywhere = true), 300);
    }

    // ==================================================
    // BANNER SPRITE
    // ==================================================
    private createBanner() {
        if (this.banner) this.banner.destroy();

        this.banner = Sprite.from(this.getBannerTexture(this.winValue));
        this.banner.anchor.set(0.5);

        this.banner.x = 0;
        this.banner.y = 0;

        this.panel.addChild(this.banner);
    }

    // ==================================================
    // HEADER TEXT (Positioned under skull & adjustable)
    // ==================================================
    private createHeaderText() {
        if (this.headerText) this.headerText.destroy();

        this.headerText = Sprite.from("green-banner-text");
        this.headerText.anchor.set(0.5);

        // ⭐ Apply both X and Y offsets
        this.headerText.x = this.banner.x + this.HEADER_OFFSET_X;
        this.headerText.y = this.banner.y + this.HEADER_OFFSET_Y;

        this.panel.addChild(this.headerText);
    }

    private getBannerTexture(win: number): string {
        if (win < 80) return "green-banner-board";
        if (win < 150) return "blue-banner-board";
        return "red-banner-board";
    }

    // ==================================================
    // DROP-DOWN ANIMATION (Correct final positions)
    // ==================================================
    private animateEntrance() {
        gsap.killTweensOf([this.banner, this.headerText]);

        const startOffset = -900;

        const finalBannerY = this.banner.y;
        const finalHeaderY = this.headerText.y;

        this.banner.alpha = 0;
        this.headerText.alpha = 0;

        // Start above screen
        this.banner.y = finalBannerY + startOffset;
        this.headerText.y = finalHeaderY + startOffset;

        gsap.to(this.banner, {
            alpha: 1,
            y: finalBannerY,
            duration: 0.7,
            ease: "bounce.out",
        });

        gsap.to(this.headerText, {
            alpha: 1,
            y: finalHeaderY,
            duration: 0.7,
            ease: "bounce.out",
            delay: 0.05,
        });
    }

    // ==================================================
    // RESIZE HANDLER
    // ==================================================
    public resize(width: number, height: number) {
        this.bg.width = width;
        this.bg.height = height;

        // Center popup
        this.panel.x = width * 0.5;
        this.panel.y = height * 0.5;

        const isMobile = height > width;

        this.banner.scale.set(1.3);
        this.headerText.scale.set(isMobile ? 1.25 : .8);

        // Reapply offsets after scaling
        this.headerText.x = this.banner.x + this.HEADER_OFFSET_X;
        this.headerText.y = this.banner.y + this.HEADER_OFFSET_Y;
    }

    // ==================================================
    // EXIT POPUP
    // ==================================================
    public async hide() {
        this.canClickAnywhere = false;

        await gsap.to([this.banner, this.headerText, this.bg], {
            alpha: 0,
            duration: 0.25,
        });

        await navigation.dismissPopup();
    }
}
