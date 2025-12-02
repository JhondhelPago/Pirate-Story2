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
                    {
                        type: 1,
                        patterns: [
                            { min: 5, max: 6, win: .5 },
                            { min: 7, max: 8, win: 1 },
                            { min: 9, max: 11, win: 2 },
                            { min: 12, max: 14, win: 3.5 },
                            { min: 15, max: 19, win: 5 },
                            { min: 20, max: 25, win: 15 },
                        ],
                    },
                    {
                        type: 2,
                        patterns: [
                            { min: 5, max: 6, win: .5 },
                            { min: 7, max: 8, win: 1 },
                            { min: 9, max: 11, win: 2 },
                            { min: 12, max: 14, win: 3.5 },
                            { min: 15, max: 19, win: 5 },
                            { min: 20, max: 25, win: 15 },
                        ],
                    },
                    {
                        type: 3,
                        patterns: [
                            { min: 5, max: 6, win: 1 },
                            { min: 7, max: 8, win: 1.5 },
                            { min: 9, max: 11, win: 3 },
                            { min: 12, max: 14, win: 4.5 },
                            { min: 15, max: 19, win: 6 },
                            { min: 20, max: 25, win: 18 },
                        ],
                    },
                    {
                        type: 4,
                        patterns: [
                            { min: 5, max: 6, win: 1 },
                            { min: 7, max: 8, win: 1.5 },
                            { min: 9, max: 11, win: 3 },
                            { min: 12, max: 14, win: 4.5 },
                            { min: 15, max: 19, win: 6 },
                            { min: 20, max: 25, win: 18 },
                        ],
                    },
                    {
                        type: 5,
                        patterns: [
                            { min: 5, max: 6, win: 1.5 },
                            { min: 7, max: 8, win: 2 },
                            { min: 9, max: 11, win: 4 },
                            { min: 12, max: 14, win: 6 },
                            { min: 15, max: 19, win: 9 },
                            { min: 20, max: 25, win: 25 },
                        ],
                    },
                    {
                        type: 6,
                        patterns: [
                            { min: 5, max: 6, win: 2 },
                            { min: 7, max: 8, win: 2.5 },
                            { min: 9, max: 11, win: 5 },
                            { min: 12, max: 14, win: 8 },
                            { min: 15, max: 19, win: 12 },
                            { min: 20, max: 25, win: 30 },
                        ],
                    },
                    {
                        type: 7,
                        patterns: [
                            { min: 5, max: 6, win: 2.5 },
                            { min: 7, max: 8, win: 3 },
                            { min: 9, max: 11, win: 6 },
                            { min: 12, max: 14, win: 10 },
                            { min: 15, max: 19, win: 15 },
                            { min: 20, max: 25, win: 40 },
                        ],
                    },
                    {
                        type: 8,
                        patterns: [
                            { min: 5, max: 6, win: 3 },
                            { min: 7, max: 8, win: 4 },
                            { min: 9, max: 11, win: 7.5 },
                            { min: 12, max: 14, win: 12 },
                            { min: 15, max: 19, win: 18 },
                            { min: 20, max: 25, win: 50 },
                        ],
                    },
                    {
                        type: 9,
                        patterns: [
                            { min: 5, max: 6, win: 4 },
                            { min: 7, max: 8, win: 5 },
                            { min: 9, max: 11, win: 9 },
                            { min: 12, max: 14, win: 16 },
                            { min: 15, max: 19, win: 24 },
                            { min: 20, max: 25, win: 60 },
                        ],
                    },
                    {
                        type: 10,
                        patterns: [
                            { min: 5, max: 6, win: 15 },
                            { min: 7, max: 8, win: 7.50 },
                            { min: 9, max: 11, win: 12 },
                            { min: 12, max: 14, win: 20 },
                            { min: 15, max: 19, win: 30 },
                            { min: 20, max: 25, win: 100 },
                        ],
                    },
                    {
                        type: 11,
                        patterns: [
                            { min: 0, max: 0, win: 0 },
                            { min: 0, max: 0, win: 0 },
                            { min: 0, max: 0, win: 0 },
                        ],
                    },
                    {
                        type: 12,
                        patterns: [
                            { min: 0, max: 0, win: 0 },
                            { min: 0, max: 0, win: 0 },
                            { min: 0, max: 0, win: 0 },
                        ],
                    },
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
