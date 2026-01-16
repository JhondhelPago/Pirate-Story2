import { Block, Paytable } from '../slot/Match3Config';

const defaultBuyFeatureBetMultiplier: number = 100;

// Default fallbacks (keep your existing arrays as fallbacks)
// const defaultBlocks: Block[] = [
//     { type: 1,  symbol: 'symbol-anchor',   name: 'Anchor' },
//     { type: 2,  symbol: 'symbol-mug',      name: 'Mug' },
//     { type: 3,  symbol: 'symbol-bomb',     name: 'Bomb' },
//     { type: 4,  symbol: 'symbol-hat',      name: 'Hat' },
//     { type: 5, symbol: 'symbol-sword',    name: 'Sword' },
//     { type: 6,  symbol: 'symbol-flag',     name: 'Flag' },
//     { type: 7, symbol: 'symbol-skull',    name: 'Skull' },
//     { type: 8,  symbol: 'symbol-canon',    name: 'Canon' },
//     { type: 9,  symbol: 'symbol-apple',    name: 'Apple' },
//     { type: 10,  symbol: 'symbol-goldbar',  name: 'Gold-bar'},
//     // { type: 11,  symbol: 'symbol-coin',     name: 'Coin' },
//     // { type: 12, symbol: 'symbol-treasure', name: 'Treasure' },
// ];

const bonusBlocks: Block[] = [{ type: 11, symbol: 'symbol-coin', name: 'Coin' }];

const wildBlocks: Block[] = [{ type: 12, symbol: 'symbol-treasure', name: 'Treasure' }];

const defaultBlocks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const specialBlocks = [11, 12];

const defaultPaytable: Paytable[] = [
    {
        type: 1,
        patterns: [
            { min: 5, max: 6, multiplier: 0.25 },
            { min: 7, max: 8, multiplier: 0.5 },
            { min: 9, max: 11, multiplier: 1 },
            { min: 12, max: 14, multiplier: 1.75 },
            { min: 15, max: 19, multiplier: 2.5 },
            { min: 20, max: 25, multiplier: 7.5 },
        ],
    },
    {
        type: 2,
        patterns: [
            { min: 5, max: 6, multiplier: 0.25 },
            { min: 7, max: 8, multiplier: 0.5 },
            { min: 9, max: 11, multiplier: 1 },
            { min: 12, max: 14, multiplier: 1.5 },
            { min: 15, max: 19, multiplier: 2.5 },
            { min: 20, max: 25, multiplier: 7.5 },
        ],
    },
    {
        type: 3,
        patterns: [
            { min: 5, max: 6, multiplier: 0.5 },
            { min: 7, max: 8, multiplier: 0.75 },
            { min: 9, max: 11, multiplier: 1.5 },
            { min: 12, max: 14, multiplier: 2.25 },
            { min: 15, max: 19, multiplier: 3 },
            { min: 20, max: 25, multiplier: 9 },
        ],
    },
    {
        type: 4,
        patterns: [
            { min: 5, max: 6, multiplier: 0.5 },
            { min: 7, max: 8, multiplier: 0.75 },
            { min: 9, max: 11, multiplier: 1.5 },
            { min: 12, max: 14, multiplier: 2.25 },
            { min: 15, max: 19, multiplier: 3 },
            { min: 20, max: 25, multiplier: 9 },
        ],
    },
    {
        type: 5,
        patterns: [
            { min: 5, max: 6, multiplier: 0.75 },
            { min: 7, max: 8, multiplier: 1 },
            { min: 9, max: 11, multiplier: 2 },
            { min: 12, max: 14, multiplier: 3 },
            { min: 15, max: 19, multiplier: 4.5 },
            { min: 20, max: 25, multiplier: 12.5 },
        ],
    },
    {
        type: 6,
        patterns: [
            { min: 5, max: 6, multiplier: 1 },
            { min: 7, max: 8, multiplier: 1.25 },
            { min: 9, max: 11, multiplier: 2.5 },
            { min: 12, max: 14, multiplier: 4 },
            { min: 15, max: 19, multiplier: 6 },
            { min: 20, max: 25, multiplier: 15 },
        ],
    },
    {
        type: 7,
        patterns: [
            { min: 5, max: 6, multiplier: 1.25 },
            { min: 7, max: 8, multiplier: 1.5 },
            { min: 9, max: 11, multiplier: 3 },
            { min: 12, max: 14, multiplier: 5 },
            { min: 15, max: 19, multiplier: 7.5 },
            { min: 20, max: 25, multiplier: 20 },
        ],
    },
    {
        type: 8,
        patterns: [
            { min: 5, max: 6, multiplier: 1.5 },
            { min: 7, max: 8, multiplier: 2 },
            { min: 9, max: 11, multiplier: 3.75 },
            { min: 12, max: 14, multiplier: 6 },
            { min: 15, max: 19, multiplier: 9 },
            { min: 20, max: 25, multiplier: 25 },
        ],
    },
    {
        type: 9,
        patterns: [
            { min: 5, max: 6, multiplier: 2 },
            { min: 7, max: 8, multiplier: 2.5 },
            { min: 9, max: 11, multiplier: 4.5 },
            { min: 12, max: 14, multiplier: 8 },
            { min: 15, max: 19, multiplier: 12 },
            { min: 20, max: 25, multiplier: 30 },
        ],
    },
    {
        type: 10,
        patterns: [
            { min: 5, max: 6, multiplier: 2.5 },
            { min: 7, max: 8, multiplier: 3.75 },
            { min: 9, max: 11, multiplier: 6 },
            { min: 12, max: 14, multiplier: 10 },
            { min: 15, max: 19, multiplier: 15 },
            { min: 20, max: 25, multiplier: 50 },
        ],
    },
];

class GameConfig {
    // Configuration data
    private blocks: number[] = defaultBlocks;
    private specialBlocks: number[] = specialBlocks;
    private paytable: Paytable[] = defaultPaytable;
    private bonusBlock: Block[] = bonusBlocks;
    private wildBlock: Block[] = wildBlocks;
    private buyFeatureBetMultiplier: number = defaultBuyFeatureBetMultiplier;

    public constructor() {}

    public getBuyFeatureBetMultiplier(): number {
        return this.buyFeatureBetMultiplier;
    }

    // Setters
    setBlocks(blocks: number[]) {
        this.blocks = blocks;
    }

    setSpecialBlocks(blocks: number[]) {
        this.specialBlocks = blocks;
    }

    setPaytables(paytable: Paytable[]) {
        this.paytable = paytable;
    }

    // Getters
    getBlocks(): number[] {
        return this.blocks;
    }

    getSpecialBlocks(): number[] {
        return this.specialBlocks;
    }

    getBonusBlocks(): Block[] {
        return this.bonusBlock;
    }

    getWildBlocks(): Block[] {
        return this.wildBlock;
    }

    getPaytables(): Paytable[] {
        return this.paytable;
    }

    // Useful for debugging
    reset(): void {
        this.blocks = defaultBlocks;
        this.paytable = defaultPaytable;
    }
}

export const gameConfig = new GameConfig();
