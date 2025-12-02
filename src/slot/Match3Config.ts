import { gameConfig } from '../utils/gameConfig';

/** Default match3 configuration */
const defaultConfig = {
    rows: 5,
    columns: 5,
    tileSize: 130,
};

/** Match3 configuration */
export type Match3Config = typeof defaultConfig;

/** Build a config object overriding default values if suitable */
export function slotGetConfig(): Match3Config {
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

/** Default pattern configuration */

export type Pattern = {
    min: number;
    max: number;
    win: number;
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
