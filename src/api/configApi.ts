import { waitFor } from '../utils/asyncUtils';

export class ConfigAPI {
    static async config() {
        try {
            await waitFor(0.7);

            return {
                rules: 'Symbols pay anywhere on the screen. The total number of the same symbol on the screen at the end of a spin determines the value of the win.',
                feature: {
                    multiplier: 100,
                },

                // ------------------------------
                // JACKPOTS (still using types 9–12, no issue)
                // ------------------------------
                jackpots: [
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
                ],

                // ------------------------------
                // PAYTABLE
                // ------------------------------
                paytable: [
                    { type: 1, patterns: [
                        { min: 5, max: 6, multiplier: 20.0 },
                        { min: 7, max: 8, multiplier: 50.0 },
                        { min: 10, max: 25, multiplier: 100.0 },
                    ]},
                    { type: 2, patterns: [
                        { min: 5, max: 6, multiplier: 5.0 },
                        { min: 7, max: 8, multiplier: 20.0 },
                        { min: 10, max: 25, multiplier: 50.0 },
                    ]},
                    { type: 3, patterns: [
                        { min: 5, max: 6, multiplier: 4.0 },
                        { min: 7, max: 8, multiplier: 10.0 },
                        { min: 9, max: 25, multiplier: 30.0 },
                    ]},
                    { type: 4, patterns: [
                        { min: 5, max: 6, multiplier: 3.0 },
                        { min: 7, max: 8, multiplier: 4.0 },
                        { min: 9, max: 25, multiplier: 24.0 },
                    ]},
                    { type: 5, patterns: [
                        { min: 5, max: 6, multiplier: 2.0 },
                        { min: 7, max: 8, multiplier: 3.0 },
                        { min: 9, max: 25, multiplier: 20.0 },
                    ]},
                    { type: 6, patterns: [
                        { min: 5, max: 6, multiplier: 1.6 },
                        { min: 7, max: 8, multiplier: 2.4 },
                        { min: 9, max: 25, multiplier: 16.0 },
                    ]},
                    { type: 7, patterns: [
                        { min: 5, max: 6, multiplier: 1.0 },
                        { min: 7, max: 8, multiplier: 2.0 },
                        { min: 10, max: 25, multiplier: 10.0 },
                    ]},
                    { type: 8,  patterns: [] },
                    { type: 9,  patterns: [] },
                    { type: 10, patterns: [] },
                    { type: 11, patterns: [] },
                    { type: 12, patterns: [] },
                ],

                // ------------------------------
                // NORMAL BLOCKS (all PNG, all consistent)
                // ------------------------------
                blocks: [
                    { type: 1,  symbol: 'symbol-anchor',   name: 'Anchor' },
                    { type: 2,  symbol: 'symbol-apple',    name: 'Apple' },
                    { type: 3,  symbol: 'symbol-bomb',     name: 'Bomb' },
                    { type: 4,  symbol: 'symbol-canon',    name: 'Canon' },
                    { type: 5,  symbol: 'symbol-coin',     name: 'Coin' },
                    { type: 6,  symbol: 'symbol-flag',     name: 'Flag' },
                    { type: 7,  symbol: 'symbol-goldbar',  name: 'Gold-bar'},
                    { type: 8,  symbol: 'symbol-hat',      name: 'Hat' },
                    { type: 9,  symbol: 'symbol-mug',      name: 'Mug' },
                    { type: 10, symbol: 'symbol-skull',    name: 'Skull' },
                    { type: 11, symbol: 'symbol-sword',    name: 'Sword' },
                    { type: 12, symbol: 'symbol-treasure', name: 'Treasure' },
                ],

                // ------------------------------
                // SCATTER (works fine)
                // ------------------------------
                scatterBlocksTrigger: 4,
                scatterBlocks: [
                    { type: 8, symbol: 'symbol-scatter', name: 'Scatter' },
                ],

                // ------------------------------
                // SPECIAL BLOCKS REMOVED (because PNG only)
                // ------------------------------
                specialBlocks: [
                    { type: 9,  symbol: 'symbol-mug',      name: 'Mug' },
                    { type: 10, symbol: 'symbol-skull',    name: 'Skull' },
                    { type: 11, symbol: 'symbol-sword',    name: 'Sword' },
                    { type: 12, symbol: 'symbol-treasure', name: 'Treasure' },
                ], // ← IMPORTANT fix
            };
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Failed loading game configuration';
            throw new Error(message);
        }
    }
}
