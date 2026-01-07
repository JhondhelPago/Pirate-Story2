import { Container, TextStyle } from "pixi.js";
import { Label } from "./Label";
import { userSettings } from "../utils/userSettings";
import { List } from "@pixi/ui";
import { PaytableCard } from "./PaytableCard";
import { ConfigAPI } from "../api/configApi";

export class PayTableSection extends Container {
    private symbolsDescriptionLabel: Label;
    private mainLayout: List;
    private betAmount: number;
    private currency: string;
    private paytables: any[] = [];
    private paytableCardsContainer: Container;
    private paytableCards: PaytableCard[] = [];
    private cardsPerRow = 3;
    private cardSpacing = 20;

    private lastResize?: { width: number; height: number };

    constructor() {
        super();

        this.betAmount = userSettings.getBet();
        this.currency = userSettings.getCurrency();

        this.mainLayout = new List({ type: "vertical", elementsMargin: 20 });
        this.addChild(this.mainLayout);

        this.symbolsDescriptionLabel = new Label(
            "Symbols pay if there is a minimum of 5 connected symbols. Your payout is based on the size of connected symbol groups.",
            {
                fill: "#ffffff",
                fontSize: 18,
                fontWeight: "200",
                wordWrap: true,
                wordWrapWidth: 800,
                align: "center",
            }
        );

        this.symbolsDescriptionLabel.anchor.set(0.5);
        this.mainLayout.addChild(this.symbolsDescriptionLabel);

        this.paytableCardsContainer = new Container();
        this.mainLayout.addChild(this.paytableCardsContainer);

        // Fetch paytables every time this component is created
        this.loadPaytables();
    }

    /** Fetch the latest paytables from the API */
    private async loadPaytables() {
        try {
            const response = await ConfigAPI.getPirateConfig();
            console.log("✅ loadPaytables success");
            console.log("data:", response.data);

            this.paytables = response.data.settings.paytable || [];

            // Clear previous cards if any
            this.paytableCardsContainer.removeChildren();
            this.paytableCards = [];

            // Create new cards based on latest data
            for (const paytable of this.paytables.slice(0, 10).reverse()) {
                const card = new PaytableCard({
                    image: `symbol-${paytable.type}`,
                    betAmount: this.betAmount,
                    currency: this.currency,
                    patterns: paytable.patterns,
                });

                // keep base scale consistent
                card.scale.set(1);

                this.paytableCardsContainer.addChild(card);
                this.paytableCards.push(card);
            }

          
            this.layoutCards();

            
            if (this.lastResize) {
                this.resize(this.lastResize.width, this.lastResize.height);
            } else {
                // fallback to desktop defaults (in case resize wasn't called yet)
                this.applyLabelStyle(18, 800, 60);
                this.cardsPerRow = 6;
                this.applyCardFontSize(18);

                this.mainLayout.y = 60;
                this.paytableCardsContainer.y = 40;

                this.layoutCards();
            }
        } catch (error) {
            console.error("Failed to load paytables:", error);
        }
    }

    private layoutCards(): void {
        if (this.paytableCards.length === 0) return;

        const cardWidth = this.paytableCards[0].width;
        const cardHeight = this.paytableCards[0].height;

        const totalColumns = Math.min(this.cardsPerRow, this.paytableCards.length);
        const gridWidth =
            totalColumns * cardWidth + (totalColumns - 1) * this.cardSpacing;

        this.paytableCards.forEach((card, index) => {
            const col = index % this.cardsPerRow;
            const row = Math.floor(index / this.cardsPerRow);

            card.x =
                col * (cardWidth + this.cardSpacing) - gridWidth / 2 + cardWidth / 2;
            card.y = row * (cardHeight + this.cardSpacing);
        });
    }

    private applyLabelStyle(fontSize: number, wordWrapWidth: number, y: number) {
        this.symbolsDescriptionLabel.y = y;

        const prev: any = (this.symbolsDescriptionLabel as any).style ?? {};
        const nextStyle = new TextStyle({
            ...(prev instanceof TextStyle ? prev : prev),
            fontSize,
            wordWrap: true,
            wordWrapWidth,
        });

        (this.symbolsDescriptionLabel as any).style = nextStyle;

        if (typeof (this.symbolsDescriptionLabel as any).updateText === "function") {
            (this.symbolsDescriptionLabel as any).updateText();
        }
    }


    private applyCardFontSize(fontSize: number) {
        for (const card of this.paytableCards) {
            (card as any).fontSize = fontSize;

            if (typeof (card as any).relayout === "function") {
                (card as any).relayout();
            } else if (typeof (card as any).resize === "function") {
                (card as any).resize();
            } else if (typeof (card as any).refresh === "function") {
                (card as any).refresh();
            }
        }
    }

    public resize(width: number, height: number) {
        this.lastResize = { width, height };

        const isMobile = document.documentElement.id === "isMobile";
        const isPortrait = width < height;
        let yAdjustment = 0;

        if (isMobile && isPortrait) {
            this.applyLabelStyle(28, 600, 100);
            this.cardsPerRow = 3;

            this.applyCardFontSize(28);

            this.mainLayout.y = 100;
            yAdjustment = 80;
        } else if (isMobile && !isPortrait) {
            this.applyLabelStyle(28, 1000, 100);
            this.cardsPerRow = 6;

            this.applyCardFontSize(28);

            this.mainLayout.y = 80;
            yAdjustment = 40;
        } else {
            this.applyLabelStyle(18, 800, 60);
            this.cardsPerRow = 6;

            this.applyCardFontSize(18);

            this.mainLayout.y = 60;
            yAdjustment = 40;
        }

        // Layout after style changes
        this.layoutCards();

        this.symbolsDescriptionLabel.x = width * 0.5;
        this.mainLayout.x = width * 0.5;
        this.mainLayout.elementsMargin = 20;
        this.paytableCardsContainer.y = yAdjustment;
    }
}
