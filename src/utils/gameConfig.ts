import { Block, Paytable } from '../slot/Match3Config';

// Default fallbacks (keep your existing arrays as fallbacks)
const defaultBlocks: Block[] = [
    {
        type: 1,
        symbol: 'symbol-anchor',
        name: 'Anchor',
    },
    {
        type: 2,
        symbol: 'symbol-apple',
        name: 'Apple',
    },
    {
        type: 3,
        symbol: 'symbol-bomb',
        name: 'Bomb',
    },
    {
        type: 4,
        symbol: 'symbol-canon',
        name: 'Canon',
    },
    {
        type: 5,
        symbol: 'symbol-coin',
        name: 'Coin',
    },
    {
        type: 6,
        symbol: 'symbol-flag',
        name: 'Flag',
    },
    {
        type: 7,
        symbol: 'gold-bar',
        name: 'Gold-bar',
    },
    {
        type: 8,
        symbol: 'symbol-hat',
        name: 'Hat',
    },
    {
        type: 9,
        symbol: 'symbol-mug',
        name: 'Mug',
    },
    {
        type: 10,
        symbol: 'symbol-skull',
        name: 'Skull',
    },
    {
        type: 11,
        symbol: 'symbol-sword',
        name: 'Sword',
    },
    {
        type: 12,
        symbol: 'symbol-treasure',
        name: 'Treasure',
    },
];


const defaultPaytable: Paytable[] = [
    {
        type: 1,
        patterns: [
            { min: 8, max: 9, multiplier: 20.0 },
            { min: 10, max: 11, multiplier: 50.0 },
            { min: 12, max: 30, multiplier: 100.0 },
        ],
    },
    {
        type: 2,
        patterns: [
            { min: 8, max: 9, multiplier: 5.0 },
            { min: 10, max: 11, multiplier: 20.0 },
            { min: 12, max: 30, multiplier: 50.0 },
        ],
    },
    {
        type: 3,
        patterns: [
            { min: 8, max: 9, multiplier: 4.0 },
            { min: 10, max: 11, multiplier: 10.0 },
            { min: 12, max: 30, multiplier: 30.0 },
        ],
    },
    {
        type: 4,
        patterns: [
            { min: 8, max: 9, multiplier: 3.0 },
            { min: 10, max: 11, multiplier: 4.0 },
            { min: 12, max: 30, multiplier: 24.0 },
        ],
    },
    {
        type: 5,
        patterns: [
            { min: 8, max: 9, multiplier: 2.0 },
            { min: 10, max: 11, multiplier: 3.0 },
            { min: 12, max: 30, multiplier: 20.0 },
        ],
    },
    {
        type: 6,
        patterns: [
            { min: 8, max: 9, multiplier: 1.6 },
            { min: 10, max: 11, multiplier: 2.4 },
            { min: 12, max: 30, multiplier: 16.0 },
        ],
    },
    {
        type: 7,
        patterns: [
            { min: 8, max: 9, multiplier: 1.0 },
            { min: 10, max: 11, multiplier: 2.0 },
            { min: 12, max: 30, multiplier: 10.0 },
        ],
    },
    {
        type: 8,
        patterns: [],
    },
    {
        type: 9,
        patterns: [],
    },
    {
        type: 10,
        patterns: [],
    },
    {
        type: 11,
        patterns: [],
    },
    {
        type: 12,
        patterns: [],
    },
];

class GameConfig {
    // Configuration data
    private blocks: Block[] = defaultBlocks;
    private paytable: Paytable[] = defaultPaytable;

    public constructor() {}

    // Setters
    setBlocks(blocks: Block[]) {
        this.blocks = blocks;
    }

    setPaytables(paytable: Paytable[]) {
        this.paytable = paytable;
    }

    // Getters
    getBlocks(): Block[] {
        return this.blocks;
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
