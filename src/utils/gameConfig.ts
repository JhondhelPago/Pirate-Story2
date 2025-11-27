import { Block, Jackpot, Paytable } from '../slot/Match3Config';

// Default fallbacks (keep your existing arrays as fallbacks)
const defaultBlocks: Block[] = [
    {
        type: 1,
        symbol: 'symbol-laurel',
        name: 'Laurel',
    },
    {
        type: 2,
        symbol: 'symbol-hourglass',
        name: 'Hourglass',
    },
    {
        type: 3,
        symbol: 'symbol-boot',
        name: 'Boot',
    },
    {
        type: 4,
        symbol: 'symbol-thunder',
        name: 'Thunder',
    },
    {
        type: 5,
        symbol: 'symbol-chalice',
        name: 'Chalice',
    },
    {
        type: 6,
        symbol: 'symbol-trident',
        name: 'Trident',
    },
    {
        type: 7,
        symbol: 'symbol-ring',
        name: 'Ring',
    },
    {
        type: 8,
        symbol: 'symbol-scatter',
        name: 'Scatter',
    },
    {
        type: 9,
        symbol: 'symbol-grand',
        name: 'Grand',
    },
    {
        type: 10,
        symbol: 'symbol-angelic',
        name: 'Angelic',
    },
    {
        type: 11,
        symbol: 'symbol-blessed',
        name: 'Blessed',
    },
    {
        type: 12,
        symbol: 'symbol-divine',
        name: 'Divine',
    },
];

const defaultScatterBlocksTrigger: number = 4;

const defaultScatterBlocks: Block[] = [
    {
        type: 8,
        symbol: 'symbol-scatter',
        name: 'Scatter',
    },
];

const defaultSpecialBlocks: Block[] = [
    {
        type: 9,
        symbol: 'symbol-grand',
        name: 'Grand',
    },
    {
        type: 10,
        symbol: 'symbol-angelic',
        name: 'Angelic',
    },
    {
        type: 11,
        symbol: 'symbol-blessed',
        name: 'Blessed',
    },
    {
        type: 12,
        symbol: 'symbol-divine',
        name: 'Divine',
    },
];

const defaultJackpot: Jackpot[] = [
    {
        id: 'divine',
        name: 'DIVINE',
        type: 12,
        multiplier: 100,
        requiredSymbols: 5,
        order: 2,
    },
    {
        id: 'blessed',
        name: 'BLESSED',
        type: 11,
        multiplier: 50,
        requiredSymbols: 4,
        order: 3,
    },
    {
        id: 'angelic',
        name: 'ANGELIC',
        type: 10,
        multiplier: 20.0,
        requiredSymbols: 3,
        order: 4,
    },
    {
        id: 'grand',
        name: 'GRAND',
        type: 9,
        multiplier: 10.0,
        requiredSymbols: 2,
        order: 5,
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
    private specialBlocks: Block[] = defaultSpecialBlocks;
    private scatterBlocksTrigger: number = defaultScatterBlocksTrigger;
    private scatterBlocks: Block[] = defaultScatterBlocks;
    private paytable: Paytable[] = defaultPaytable;
    private jackpots: Jackpot[] = defaultJackpot;

    public constructor() {}

    // Setters
    setBlocks(blocks: Block[]) {
        this.blocks = blocks;
    }

    setSpecialBlocks(blocks: Block[]) {
        this.specialBlocks = blocks;
    }

    setScatterBlocksTrigger(count: number) {
        this.scatterBlocksTrigger = count;
    }

    setScatterBlocks(blocks: Block[]) {
        this.scatterBlocks = blocks;
    }

    setPaytables(paytable: Paytable[]) {
        this.paytable = paytable;
    }

    setJackpots(jackpots: Jackpot[]) {
        this.jackpots = jackpots;
    }

    // Getters
    getBlocks(): Block[] {
        return this.blocks;
    }

    getSpecialBlocks(): Block[] {
        return this.specialBlocks;
    }

    getScatterBlocksTrigger() {
        return this.scatterBlocksTrigger;
    }

    getScatterBlocks(): Block[] {
        return this.scatterBlocks;
    }

    getPaytables(): Paytable[] {
        return this.paytable;
    }

    getJackpots(): Jackpot[] {
        return this.jackpots;
    }

    // Useful for debugging
    reset(): void {
        this.blocks = defaultBlocks;
        this.paytable = defaultPaytable;
        this.scatterBlocks = defaultScatterBlocks;
        this.specialBlocks = defaultSpecialBlocks;
    }
}

export const gameConfig = new GameConfig();
