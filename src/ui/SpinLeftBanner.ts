import { Container, Sprite, Text, Texture, Matrix } from 'pixi.js';

export class SpinLeftBanner extends Container {
    private bg: Sprite;
    private labelText: Text;

    private spinsLeft = 0;

    // 🔒 Hard-coded asset key (you will change this)
    private static readonly BG_TEXTURE_KEY = 'buy-spin-confirm-board';

    // ===== Gradient cache (shared) =====
    private static labelGradientTexture: Texture | null = null;
    private static labelGradientMatrix: Matrix | null = null;

    constructor() {
        super();

        // Background
        this.bg = Sprite.from(SpinLeftBanner.BG_TEXTURE_KEY);
        this.bg.anchor.set(0.5);
        this.bg.scale.set(1);
        this.bg.visible = false;
        this.addChild(this.bg);

        // Gradient ready
        this.ensureLabelGradient();

        // Text (same styling pattern: gradient fill + stroke)
        this.labelText = new Text({
            text: this.buildLabel(this.spinsLeft),
            style: {
                fontFamily: 'Pirata One',
                fontSize: 96, // bigger by default
                align: 'center',

                // ✅ gradient fill (like your previous request)
                fill:
                    SpinLeftBanner.labelGradientTexture && SpinLeftBanner.labelGradientMatrix
                        ? {
                              texture: SpinLeftBanner.labelGradientTexture,
                              matrix: SpinLeftBanner.labelGradientMatrix,
                          }
                        : 0xffffff,

                // ✅ stroke style (same as your earlier snippet)
                stroke: {
                    color: 0x4c1b05,
                    width: 6,
                },

                // optional: matches your other label vibe
                letterSpacing: 1,
            } as any,
        });

        this.labelText.anchor.set(0.5);
        this.addChild(this.labelText);

        this.layout();
    }

    private buildLabel(value: number): string {
        return `Win:  ${value}`;
    }

    /**
     * Creates and caches a vertical gradient texture + matrix
     * (same stops you used before for banner labels).
     */
    private ensureLabelGradient() {
        if (SpinLeftBanner.labelGradientTexture && SpinLeftBanner.labelGradientMatrix) return;

        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;

        const ctx = gradientCanvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);

        // ✅ same gradient stops you provided earlier
        gradient.addColorStop(0.0, '#FFF39C');
        gradient.addColorStop(0.19, '#FFF39C');
        gradient.addColorStop(0.34, '#FDD44F');
        gradient.addColorStop(0.4, '#FDD44F');
        gradient.addColorStop(0.51, '#FDD44F');
        gradient.addColorStop(1.0, '#D79600');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        SpinLeftBanner.labelGradientTexture = Texture.from(gradientCanvas);

        // IMPORTANT:
        // This matrix maps the gradient texture into the text’s local texture space.
        // We'll also update it on layout to match current font size nicely.
        SpinLeftBanner.labelGradientMatrix = new Matrix();

        // initial set (will be refined in layout)
        SpinLeftBanner.labelGradientMatrix.scale(1, 1);
    }

    /* ===============================
       Public API
    =============================== */

    public setSpinsLeft(value: number) {
        this.spinsLeft = Math.max(0, Math.floor(value));
        this.labelText.text = this.buildLabel(this.spinsLeft);

        // re-apply fill (in case Pixi re-created style internals)
        this.applyGradientStyle();

        this.layout();
    }

    public getSpinsLeft(): number {
        return this.spinsLeft;
    }

    /** Optional if you want to tweak size quickly */
    public setFontSize(size: number) {
        (this.labelText.style as any).fontSize = Math.max(1, Math.floor(size));
        this.applyGradientStyle();
        this.layout();
    }

    /* ===============================
       Internals
    =============================== */

    private applyGradientStyle() {
        // keep your stroke consistent
        (this.labelText.style as any).stroke = { color: 0x4c1b05, width: 6 };

        // ensure gradient exists
        this.ensureLabelGradient();

        const tex = SpinLeftBanner.labelGradientTexture;
        const mat = SpinLeftBanner.labelGradientMatrix;

        if (tex && mat) {
            // Update the matrix so the gradient "fits" the text height.
            // (Maps gradientCanvas.height into roughly the fontSize height.)
            const fontSize = Number((this.labelText.style as any).fontSize ?? 96);
            const canvasH = 256;

            // Reset then scale Y so the gradient spans the glyph height
            mat.identity();
            mat.scale(1, canvasH / Math.max(1, fontSize));

            (this.labelText.style as any).fill = { texture: tex, matrix: mat };
        } else {
            (this.labelText.style as any).fill = 0xffffff;
        }
    }

    private layout() {
        // Center everything in local space
        this.bg.position.set(0, 0);
        this.labelText.position.set(0, 0);

        // Make sure gradient matrix stays correct after any font changes
        this.applyGradientStyle();
    }
}
