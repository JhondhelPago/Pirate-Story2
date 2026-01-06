export class ConfigAPI {
    static async config() {
        try {
            return {
                rules: 'Symbols pay anywhere on the screen. The total number of the same symbol on the screen at the end of a spin determines the value of the win.',
                feature: {
                    A: {spins: 10, scatters: 3, buyFeatureBetMultiplier: 100},
                    B: {spins: 15, scatters: 4, buyFeatureBetMultiplier: 500},
                    C: {spins: 20, scatters: 5, buyFeatureBetMultiplier: 1000},
                },
                buyFeatureBetMultiplier: 100,
                "langauge": "ko",
                "currency": "KRW",
                "bettingLimit": {
                    "MAX": "100000",
                    "MIN": "100",
                    "MONEY_OPTION": [
                        100,
                        200,
                        300,
                        400,
                        500,
                        1000,
                        2000,
                        3000,
                        4000,
                        5000,
                        10000,
                        20000,
                        30000,
                        40000,
                        50000,
                        100000
                    ]
                },
                settings: {
                    "features": [
                        {spins: 5, scatters: 3, buyFeatureBetMultiplier: 100},
                        {spins: 15, scatters: 4, buyFeatureBetMultiplier: 500},
                        {spins: 20, scatters: 5, buyFeatureBetMultiplier: 1000},
                    ],
                    "freeSpins": [
                        {
                            "count": 3,
                            "spins": 10
                        },
                        {
                            "count": 4,
                            "spins": 15
                        },
                        {
                            "count": 5,
                            "spins": 20
                        }
                    ],
                    "extraFreeSpins": [
                        {
                            "count": 2,
                            "spins": 5
                        },
                        {
                            "count": 3,
                            "spins": 10
                        },
                        {
                            "count": 4,
                            "spins": 20
                        },
                        {
                            "count": 5,
                            "spins": 30
                        }
                    ],
                },


                // ------------------------------
                // PAYTABLE
                // ------------------------------
                paytable: [
                    {
                        type: 1,
                        patterns: [
                            { min: 5, max: 6, multiplier: .25 },
                            { min: 7, max: 8, multiplier: .5 },
                            { min: 9, max: 11, multiplier: 1 },
                            { min: 12, max: 14, multiplier: 1.75 },
                            { min: 15, max: 19, multiplier: 2.5 },
                            { min: 20, max: 25, multiplier: 7.5 },
                        ],
                    },
                    {
                        type: 2,
                        patterns: [
                            { min: 5, max: 6, multiplier: .25 },
                            { min: 7, max: 8, multiplier: .5 },
                            { min: 9, max: 11, multiplier: 1 },
                            { min: 12, max: 14, multiplier: 1.5 },
                            { min: 15, max: 19, multiplier: 2.5 },
                            { min: 20, max: 25, multiplier: 7.5 },
                        ],
                    },
                    {
                        type: 3,
                        patterns: [
                            { min: 5, max: 6, multiplier: .5 },
                            { min: 7, max: 8, multiplier: .75 },
                            { min: 9, max: 11, multiplier: 1.5 },
                            { min: 12, max: 14, multiplier: 2.25 },
                            { min: 15, max: 19, multiplier: 3 },
                            { min: 20, max: 25, multiplier: 9 },
                        ],
                    },
                    {
                        type: 4,
                        patterns: [
                            { min: 5, max: 6, multiplier: .5 },
                            { min: 7, max: 8, multiplier: .75 },
                            { min: 9, max: 11, multiplier: 1.5 },
                            { min: 12, max: 14, multiplier: 2.25 },
                            { min: 15, max: 19, multiplier: 3 },
                            { min: 20, max: 25, multiplier: 9 },
                        ],
                    },
                    {
                        type: 5,
                        patterns: [
                            { min: 5, max: 6, multiplier: .75 },
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
                ],

                // ------------------------------
                // NORMAL BLOCKS (all PNG, all consistent)
                // ------------------------------
                // blocks: [
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
                //     { type: 11,  symbol: 'symbol-coin',     name: 'Coin' },
                //     { type: 12, symbol: 'symbol-treasure', name: 'Treasure' },
                // ],

                // specialBlocks: [
                //     { type: 11, symbol: 'symbol-coin', name: 'Coin' }, //bonus
                //     { type: 12, symbol: 'symbol-treasure', name: 'Treasure' }, //wild
                // ],

                "blocks": [
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    9,
                    10,
                    11,
                    12
                ],
                "specialBlocks": [
                    11,
                    12
                ]
            };

            // return {
            //     "language": "ko",
            //     "currency": "KRW",
            //     "bettingLimit": {
            //         "MAX": "100000",
            //         "MIN": "100",
            //         "MONEY_OPTION": [
            //             100,
            //             200,
            //             300,
            //             400,
            //             500,
            //             1000,
            //             2000,
            //             3000,
            //             4000,
            //             5000,
            //             10000,
            //             20000,
            //             30000,
            //             40000,
            //             50000,
            //             100000
            //         ]
            //     },
            //     "settings": {
            //         "features": [
            //             {
            //                 "spins": 5,
            //                 "scatters": 3,
            //                 "buyFeatureBetMultiplier": 100
            //             },
            //             {
            //                 "spins": 15,
            //                 "scatters": 4,
            //                 "buyFeatureBetMultiplier": 500
            //             },
            //             {
            //                 "spins": 20,
            //                 "scatters": 5,
            //                 "buyFeatureBetMultiplier": 1000
            //             }
            //         ],
            //         "buyFeatureBetMultiplier": 100,
            //         "scatterType": 10,
            //         "freeSpins": [
            //             {
            //                 "count": 3,
            //                 "spins": 10
            //             },
            //             {
            //                 "count": 4,
            //                 "spins": 15
            //             },
            //             {
            //                 "count": 5,
            //                 "spins": 20
            //             }
            //         ],
            //         "extraFreeSpins": [
            //             {
            //                 "count": 2,
            //                 "spins": 5
            //             },
            //             {
            //                 "count": 3,
            //                 "spins": 10
            //             },
            //             {
            //                 "count": 4,
            //                 "spins": 20
            //             },
            //             {
            //                 "count": 5,
            //                 "spins": 30
            //             }
            //         ],
            //         "paytable": [
            //             {
            //                 "type": 1,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 0.25
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 0.5
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 1
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 1.75
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 2.5
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 7.5
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 2,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 0.25
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 0.5
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 1
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 1.5
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 2.5
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 7.5
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 3,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 0.5
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 0.75
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 1.5
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 2.25
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 3
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 9
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 4,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 0.5
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 0.75
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 1.5
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 2.25
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 3
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 9
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 5,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 0.75
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 1
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 2
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 3
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 4.5
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 12.5
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 6,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 1
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 1.25
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 2.5
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 4
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 6
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 15
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 7,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 1.25
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 1.5
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 3
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 5
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 7.5
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 20
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 8,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 1.5
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 2
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 3.75
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 6
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 9
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 25
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 9,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 2
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 2.5
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 4.5
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 8
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 12
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 30
            //                     }
            //                 ]
            //             },
            //             {
            //                 "type": 10,
            //                 "patterns": [
            //                     {
            //                         "min": 5,
            //                         "max": 6,
            //                         "multiplier": 2.5
            //                     },
            //                     {
            //                         "min": 7,
            //                         "max": 8,
            //                         "multiplier": 3.75
            //                     },
            //                     {
            //                         "min": 9,
            //                         "max": 11,
            //                         "multiplier": 6
            //                     },
            //                     {
            //                         "min": 12,
            //                         "max": 14,
            //                         "multiplier": 10
            //                     },
            //                     {
            //                         "min": 15,
            //                         "max": 19,
            //                         "multiplier": 15
            //                     },
            //                     {
            //                         "min": 20,
            //                         "max": 25,
            //                         "multiplier": 50
            //                     }
            //                 ]
            //             }
            //         ],
            //         "blocks": [
            //             1,
            //             2,
            //             3,
            //             4,
            //             5,
            //             6,
            //             7,
            //             8,
            //             9,
            //             10,
            //             11,
            //             12
            //         ],
            //         "specialBlocks": [
            //             11,
            //             12
            //         ]
            //     }
            // }

        } catch (error: any) {
            const message = error?.response?.data?.message || 'Failed loading game configuration';
            throw new Error(message);
        }
    }
}
