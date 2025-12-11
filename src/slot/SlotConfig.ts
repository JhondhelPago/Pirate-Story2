import { gameConfig } from '../utils/gameConfig';

/** Default match3 configuration */
const defaultConfig = {
    rows: 5,
    columns: 6,
    tileSize: 130,
};

/** Slot configuration */
export type SlotConfig = typeof defaultConfig;

/** Build a config object overriding default values if suitable */
export function slotGetConfig(): SlotConfig {
    return defaultConfig;
}

/**
 * Map of all available blocks for the game.
 * Each item in these lists should have a corresponding pixi texture with the same name
 */

/** Default match3 configuration */
const defaultBlock = {
    type: 0,
    symbol: 'symbol-placeholder',
    name: 'Placeholder',
};

export type Block = typeof defaultBlock;

/** Mount a list of blocks available */
export function slotGetBlocks(): Block[] {
    return gameConfig.getBlocks();
}

/** Default special block tier configuration */
const defaultJackpot = {
    id: 'grand',
    name: 'GRAND',
    type: 9,
    multiplier: 100,
    requiredSymbols: 5,
    order: 2,
};

export type Jackpot = typeof defaultJackpot;

/** Default pattern configuration */

export type Pattern = {
    min: number;
    max: number;
    multiplier: number;
};

const defaultPaytable = {
    type: 0,
    patterns: [] as Pattern[],
};

export type Paytable = typeof defaultPaytable;

/** Mount a list of patterns available*/
export function slotGetPaytables(): Paytable[] {
    return gameConfig.getPaytables();
}
