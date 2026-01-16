import { Container, Text } from 'pixi.js';
import { MatchPattern } from './MatchPattern';

export interface WinMatchPattern {
    times: number;
    type: number;
    amount: number;
    currency: string;
}

export class MessagePanel extends Container {
    private titleText: Text;
    private messageText: Text;
    private matchPattern: MatchPattern;

    private winMatchPatterns: WinMatchPattern[] = [];
    private shouldStopMatches = false;

    private panelWidth = 1920;
    private panelHeight = 160;
    private readonly matchMessageYOffset = 50;

    // ===== Unified text color =====
    private readonly TEXT_COLOR = 0xffd700;

    // current visual scale applied from GameScreen
    private visualScale = 1;

    // ===== Font scaling =====
    private readonly baseWidth = 1920;

    private clamp(v: number, min: number, max: number) {
        return Math.max(min, Math.min(max, v));
    }

    private getScale(): number {
        const s = this.panelWidth / this.baseWidth;
        return this.clamp(s, 0.7, 1.2);
    }

    private getTitleFontSize(): number {
        return Math.round(32 * this.getScale());
    }

    private getWinTitleFontSize(): number {
        return Math.round(52 * this.getScale());
    }

    private getMessageFontSize(): number {
        return Math.round(28 * this.getScale());
    }

    private applyFontSizes(): void {
        this.titleText.style.fontSize = this.getTitleFontSize();
        this.messageText.style.fontSize = this.getMessageFontSize();
    }

    private applyTextColors(): void {
        this.titleText.style.fill = this.TEXT_COLOR;
        this.messageText.style.fill = this.TEXT_COLOR;
    }

    constructor() {
        super();

        /* ===============================
           TITLE TEXT
        =============================== */
        this.titleText = new Text({
            text: '',
            style: {
                fontSize: 64,
                fill: this.TEXT_COLOR,
                fontWeight: 'bold',
            },
        });
        this.titleText.anchor.set(0.5, 0.75);
        this.addChild(this.titleText);

        /* ===============================
           MATCH PATTERN (WIN BANNER)
        =============================== */
        this.matchPattern = new MatchPattern();
        this.addChild(this.matchPattern);

        /* ===============================
           MESSAGE TEXT
        =============================== */
        this.messageText = new Text({
            text: '',
            style: {
                fontSize: 64,
                fill: this.TEXT_COLOR,
                fontWeight: 'bold',
                letterSpacing: 1,
            },
        });

        this.messageText.anchor.set(0.5, -0.75);
        this.addChild(this.messageText);
        this.messageText.visible = false;

        this.applyFontSizes();
        this.applyTextColors();
    }

    /* ===============================
       Layout
    =============================== */
    public resize(width: number, height: number, visualScale: number = 1) {
        this.panelWidth = width;
        this.panelHeight = height;

        this.visualScale = Math.max(0.01, visualScale);
        this.scale.set(this.visualScale);

        const localW = width / this.visualScale;
        const localH = height / this.visualScale;

        this.pivot.set(localW * 0.5, localH * 0.5);

        this.titleText.x = localW * 0.5;
        this.titleText.y = localH * 0.5;

        this.messageText.x = localW * 0.5;
        this.messageText.y = localH * 0.5;

        this.matchPattern.x = localW * 0.5 - this.matchPattern.width * 0.5;
        this.matchPattern.y = localH - this.matchPattern.height - 20 + this.matchMessageYOffset;

        this.applyFontSizes();
        this.applyTextColors();
    }

    /* ===============================
       Text Controls
    =============================== */

    public setTitle(title: string) {
        this.titleText.text = title;
        this.titleText.visible = true;
        this.titleText.style.fontSize = this.getTitleFontSize();
        this.applyTextColors();
        this.titleText.anchor.set(0.5, 0.75);
    }

    public setWinTitle(title: string) {
        this.titleText.text = title;
        this.titleText.visible = true;
        this.titleText.style.fontSize = this.getWinTitleFontSize();
        this.applyTextColors();
        this.titleText.anchor.set(0.5, 1);
    }

    public clearTitle() {
        this.titleText.text = '';
        this.titleText.visible = false;
    }

    public setMessage(message: string) {
        this.messageText.text = message;
        this.messageText.visible = true;
        this.messageText.style.fontSize = this.getMessageFontSize();
        this.applyTextColors();

        const localW = this.panelWidth / this.visualScale;
        const localH = this.panelHeight / this.visualScale;

        this.messageText.x = localW * 0.5;
        this.messageText.y = localH * 0.5;
    }

    public clearMessage() {
        this.messageText.text = '';
        this.messageText.visible = false;
    }

    /* ===============================
       Match Message Queue
    =============================== */

    public addMatchMessage(times: number, type: number, amount: number, currency: string) {
        if (!amount || amount <= 0 || Number.isNaN(amount)) return;

        this.winMatchPatterns.push({ times, type, amount, currency });
    }

    public async playMatchMessages() {
        this.shouldStopMatches = false;

        if (this.winMatchPatterns.length === 0) {
            this.clearMessage();
            return;
        }

        this.messageText.visible = true;

        const localW = this.panelWidth / this.visualScale;
        const localH = this.panelHeight / this.visualScale;

        for (const pattern of this.winMatchPatterns) {
            if (this.shouldStopMatches) break;

            this.matchPattern.setup(pattern.times, `symbol-${pattern.type}`, pattern.amount, pattern.currency);

            this.matchPattern.x = localW * 0.5 - this.matchPattern.width * 0.5;
            this.matchPattern.y = localH - this.matchPattern.height - 20 + this.matchMessageYOffset;

            this.messageText.alpha = 0;

            await this.matchPattern.show();

            // 🔴 IMPORTANT: re-apply color AFTER show()
            this.applyTextColors();

            this.messageText.alpha = 1;
        }

        this.winMatchPatterns = [];
        this.shouldStopMatches = false;
    }

    public stopMatchMessages() {
        this.shouldStopMatches = true;
        this.matchPattern.hide();
        this.winMatchPatterns = [];
    }
}
