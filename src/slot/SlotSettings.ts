import { GameServices } from '../api/services';
import { tryRefreshToken } from '../api/services/authServices';
import { getUrlParam } from '../utils/getUrlParams';
import { userAuth } from '../utils/userAuth';

async function authenticateLogin() {
    const urlToken = getUrlParam('token');
    try {
        if (urlToken) {
            await userAuth.login(urlToken);
            // userAuth.setGameCode(gameCode);
            const url = new URL(window.location.href);
            // url.searchParams.delete('token');
            window.history.replaceState({}, '', url.toString());
            return true;
        }

        return await tryRefreshToken();
    } catch (err) {
        return false;
    }
}

// initial post request to the api to get the game configuration and authentication for the slot user
export const isAuthenticated = await authenticateLogin();


class Config {
    private static config = {
        "language": "ko",
        "currency": "KRW",
        "bettingLimit": {
            "MAX": "100000",
            "MIN": "10",
            "MONEY_OPTION": [
                10,
                20,
                50,
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
        "settings": {
            "maxBaseMultiplier": 7500,
            "maxBonusMultiplier": 7500,
            "features": [
                {
                    "spins": 10,
                    "scatters": 3,
                    "buyFeatureBetMultiplier": 100
                },
                {
                    "spins": 15,
                    "scatters": 4,
                    "buyFeatureBetMultiplier": 500
                },
                {
                    "spins": 20,
                    "scatters": 5,
                    "buyFeatureBetMultiplier": 1000
                }
            ],
            "scatterType": 11,
            "wildType": 12,
            "wildMultipliers": [
                2,
                3,
                5,
                10
            ],
            "wildMultiplierWeights": [
                75,
                50,
                25,
                1
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
            "paytables": [
                {
                    "type": 1,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 2.5
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 3.75
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 6
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 10
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 15
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 50
                        }
                    ]
                },
                {
                    "type": 2,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 2
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 2.5
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 4.5
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 8
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 12
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 30
                        }
                    ]
                },
                {
                    "type": 3,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 1.5
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 2
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 3.75
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 6
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 9
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 25
                        }
                    ]
                },
                {
                    "type": 4,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 1.25
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 1.5
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 3
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 5
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 7.5
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 20
                        }
                    ]
                },
                {
                    "type": 5,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 1
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 1.25
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 2.5
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 4
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 6
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 15
                        }
                    ]
                },
                {
                    "type": 6,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 0.75
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 1
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 2
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 3
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 4.5
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 12.5
                        }
                    ]
                },
                {
                    "type": 7,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 0.5
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 0.75
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 1.5
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 2.25
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 3
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 9
                        }
                    ]
                },
                {
                    "type": 8,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 0.5
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 0.75
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 1.50
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 2.25
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 3
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 9
                        }
                    ]
                },
                {
                    "type": 9,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 0.25
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 0.5
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 1
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 1.75
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 2.5
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 7.5
                        }
                    ]
                },
                {
                    "type": 10,
                    "patterns": [
                        {
                            "min": 5,
                            "max": 6,
                            "multiplier": 0.25
                        },
                        {
                            "min": 7,
                            "max": 8,
                            "multiplier": 0.5
                        },
                        {
                            "min": 9,
                            "max": 11,
                            "multiplier": 1
                        },
                        {
                            "min": 12,
                            "max": 14,
                            "multiplier": 1.75
                        },
                        {
                            "min": 15,
                            "max": 19,
                            "multiplier": 2.50
                        },
                        {
                            "min": 20,
                            "max": 25,
                            "multiplier": 7.5
                        }
                    ]
                }
            ],
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
        }
    }
    static getConfig() {
        return this.config;
    }


    static setConfig(newConfig: any) {
        this.config = newConfig;
    }
}

export default Config

//PIRATE STORY GAME CONFIG
// const response = await GameServices.getGameConfig();
// export const config = response.data;
