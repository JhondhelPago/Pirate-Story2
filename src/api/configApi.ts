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
                // PAYTABLE
                // ------------------------------
                paytable: [
                    { type: 1, patterns: [
                        { min: 5, max: 6, win: 20.0 },
                        { min: 7, max: 8, win: 50.0 },
                        { min: 10, max: 25, win: 100.0 },
                    ]},
                    { type: 2, patterns: [
                        { min: 5, max: 6, win: 5.0 },
                        { min: 7, max: 8, win: 20.0 },
                        { min: 10, max: 25, win: 50.0 },
                    ]},
                    { type: 3, patterns: [
                        { min: 5, max: 6, win: 4.0 },
                        { min: 7, max: 8, win: 10.0 },
                        { min: 9, max: 25, win: 30.0 },
                    ]},
                    { type: 4, patterns: [
                        { min: 5, max: 6, win: 3.0 },
                        { min: 7, max: 8, win: 4.0 },
                        { min: 9, max: 25, win: 24.0 },
                    ]},
                    { type: 5, patterns: [
                        { min: 5, max: 6, win: 2.0 },
                        { min: 7, max: 8, win: 3.0 },
                        { min: 9, max: 25, win: 20.0 },
                    ]},
                    { type: 6, patterns: [
                        { min: 5, max: 6, win: 1.6 },
                        { min: 7, max: 8, win: 2.4 },
                        { min: 9, max: 25, win: 16.0 },
                    ]},
                    { type: 7, patterns: [
                        { min: 5, max: 6, win: 1.0 },
                        { min: 7, max: 8, win: 2.0 },
                        { min: 10, max: 25, win: 10.0 },
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
                    { type: 2,  symbol: 'symbol-mug',      name: 'Mug' },
                    { type: 3,  symbol: 'symbol-bomb',     name: 'Bomb' },
                    { type: 4,  symbol: 'symbol-hat',      name: 'Hat' },
                    { type: 5, symbol: 'symbol-sword',    name: 'Sword' },
                    { type: 6,  symbol: 'symbol-flag',     name: 'Flag' },
                    { type: 7, symbol: 'symbol-skull',    name: 'Skull' },
                    { type: 8,  symbol: 'symbol-canon',    name: 'Canon' },
                    { type: 9,  symbol: 'symbol-apple',    name: 'Apple' },
                    { type: 10,  symbol: 'symbol-goldbar',  name: 'Gold-bar'},
                    { type: 11,  symbol: 'symbol-coin',     name: 'Coin' },
                    { type: 12, symbol: 'symbol-treasure', name: 'Treasure' },
                ],
                

                specialBlocks: [
                    { type: 11, symbol: 'symbol-coin', name: 'Coin' }, //bonus
                    { type: 12, symbol: 'symbol-treasure', name: 'Treasure' }, //wild
                ],
            };
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Failed loading game configuration';
            throw new Error(message);
        }
    }
}
