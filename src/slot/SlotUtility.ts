import { gameConfig } from '../utils/gameConfig';
import { Pattern } from './Match3Config';
import { userSettings } from '../utils/userSettings';

/** Piece type on each position in the grid */
export type Match3Type = number;

/** Piece type on each position in the grid */
export type Match3Frame = string;

/** Two-dimensional array represeinting the game board */
export type Match3Grid = Match3Type[][];

/** Pair of row & column representing grid coordinates */
export type Match3Position = { row: number; column: number };

/** Pair of row & column representing grid coordinates */
export type Match3GlobalPosition = { x: number; y: number };

/** Orientation for match checks */
export type Match3Orientation = 'horizontal' | 'vertical';

// multiplier 
export const multiplierValues = [2, 3, 5];
export type MultipliersValues = typeof multiplierValues[number];

export type RoundResult = {
    type: number;
    count: number;
    multiplier: number;
    positions: Match3Position[];
}[];

/**
 * Create a 2D grid matrix filled up with given types
 * Example:
 * [[1, 1, 2, 3]
 *  [3, 1, 1, 3]
 *  [1, 2, 3, 2]
 *  [2, 3, 1, 3]]
 * @param rows Number of rows
 * @param columns Number of columns
 * @param types List of types avaliable to fill up slots
 * @returns A 2D array filled up with types
 */
export function match3CreateGrid(rows = 5, columns = 5, types: Match3Type[]) {
    const grid: Match3Grid = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            let type = match3GetRandomType(types);

            // List of rejected types for this position, to prevent them to be picked again
            const excludeList: Match3Type[] = [];

            // If the new type match previous types, randomise it again, excluding rejected type
            // to avoid building the grid with pre-made matches
            while (matchPreviousTypes(grid, { row: r, column: c }, type)) {
                excludeList.push(type);
                type = match3GetRandomType(types, excludeList);
            }

            // Create the new row if not exists
            if (!grid[r]) grid[r] = [];

            // Set type for the grid position
            grid[r][c] = type;
        }
    }

    return grid as Match3Grid;
}

/**
 * Create a copy of provided grid
 * @param grid The grid to be cloned
 * @returns A copy of the original grid
 */
export function match3CloneGrid(grid: Match3Grid) {
    const clone: Match3Grid = [];
    for (const row of grid) {
        clone.push(row.slice());
    }
    return clone;
}

/** Check if given type match previous positions in the grid  */
function matchPreviousTypes(grid: Match3Grid, position: Match3Position, type: Match3Type) {
    // Check if previous horizontal positions are forming a match
    const horizontal1 = grid?.[position.row]?.[position.column - 1];
    const horizontal2 = grid?.[position.row]?.[position.column - 2];
    const horizontalMatch = type === horizontal1 && type === horizontal2;

    // Check if previous vertical positions are forming a match
    const vertical1 = grid?.[position.row - 1]?.[position.column];
    const vertical2 = grid?.[position.row - 2]?.[position.column];
    const verticalMatch = type === vertical1 && type === vertical2;

    // Return if either horizontal or vertical psoitions are forming a match
    return horizontalMatch || verticalMatch;
}

/**
 * Get a random type from the type list
 * @param types List of types available to return
 * @param exclude List of types to be excluded from the result
 * @returns A random type picked from the given list
 */
export function match3GetRandomType(types: Match3Type[], exclude?: Match3Type[]) {
    let list = [...types];

    if (exclude) {
        // If exclude list is provided, exclude them from the available list
        list = types.filter((type) => !exclude.includes(type));
    }

    const index = Math.floor(Math.random() * list.length);

    return list[index];
}


/**
 * Set the piece type in the grid, by position
 * @param grid The grid to be changed
 * @param position The position to be changed
 * @param type The new type for given position
 */
export function match3SetPieceType(grid: Match3Grid, position: Match3Position, type: number) {
    grid[position.row][position.column] = type;
}

/**
 * Retrieve the piece type from a grid, by position
 * @param grid The grid to be looked up
 * @param position The position in the grid
 * @returns The piece type from given position, undefined if position is invalid
 */
export function match3GetPieceType(grid: Match3Grid, position: Match3Position) {
    return grid?.[position.row]?.[position.column];
}

/**
 * Check if a position is valid in the grid
 * @param grid The grid in context
 * @param position The position to be validated
 * @returns True if position exists in the grid, false if out-of-bounds
 */
export function match3IsValidPosition(grid: Match3Grid, position: Match3Position) {
    const rows = grid.length;
    const cols = grid[0].length;
    return position.row >= 0 && position.row < rows && position.column >= 0 && position.column < cols;
}

/**
 * Loop through every position in the grid
 * @param grid The grid in context
 * @param fn Callback for each position in the grid
 */
export function match3ForEach(grid: Match3Grid, fn: (position: Match3Position, type: Match3Type) => void) {
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            fn({ row: r, column: c }, grid[r][c]);
        }
    }
}



/**
 * Convert grid to a visual string representation, useful for debugging
 * @param grid The grid to be converted
 * @returns String representing the grid
 */
export function match3GridToString(grid: Match3Grid) {
    const lines: string[] = [];
    for (const row of grid) {
        const list = row.map((type) => String(type).padStart(2, '0'));
        lines.push('|' + list.join('|') + '|');
    }
    return lines.join('\n');
}


/**
 * Filter out repeated positions from position list
 * @param positions List of positions to be filtered
 * @returns A new list without repeated positions
 */
export function match3FilterUniquePositions(positions: Match3Position[]) {
    const result: Match3Position[] = [];
    const register: string[] = [];

    for (const position of positions) {
        const id = position.row + ':' + position.column;
        if (!register.includes(id)) {
            register.push(id);
            result.push(position);
        }
    }

    return result;
}

/**
 * Convert a grid position to string, useful for mapping values
 * @param position The position to be stringified
 * @returns A string representation of the position. Ex.: {row: 3, column: 1} => "3:1"
 */
export function match3PositionToString(position: Match3Position) {
    return position.row + ':' + position.column;
}

/**
 * Convert back a string to grid position
 * @param str The string to be converted to a grid position
 * @returns A position object. Ex.: "3:1" => {row: 3, column: 1}
 */
export function match3StringToPosition(str: string) {
    const split = str.split(':');
    return { row: Number(split[0]), column: Number(split[1]) };
}

export function getRandomMultiplier(): MultipliersValues {
  const index = Math.floor(Math.random() * multiplierValues.length);
  return multiplierValues[index];
}


// ======================================================
//  PIRATE STORY PATTERN RECOGNITION + MULTIPLIER SYSTEM
// ======================================================

// ======================================================
//  PIRATE STORY PATTERN RECOGNITION + MULTIPLIER SYSTEM
// ======================================================

export const WILD = 12;
export const SCATTERBONUS = 11;

type ClusterWinResult = {
    type: number;
    count: number;
    multiplier: number;  
    positions: Match3Position[];
};

/**
 * Flood-fill physically connected cluster:
 * - Same type connects
 * - Wild connects to all
 * - No merging unrelated groups
 */
function floodFillCluster(
    grid: Match3Grid,
    start: Match3Position,
    baseType: number,
    localVisited: boolean[][]
): Match3Position[] {

    const stack = [start];
    const region: Match3Position[] = [];

    while (stack.length > 0) {
        const pos = stack.pop()!;
        const { row, column } = pos;

        if (localVisited[row][column]) continue;
        localVisited[row][column] = true;

        const t = grid[row][column];
        region.push(pos);

        const dirs = [
            { r: 1, c: 0 },
            { r: -1, c: 0 },
            { r: 0, c: 1 },
            { r: 0, c: -1 },
        ];

        for (const d of dirs) {
            const nr = row + d.r;
            const nc = column + d.c;

            if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length)
                continue;

            const nt = grid[nr][nc];

            // ❌ prevent SCATTERBONUS from joining clusters
            if (nt === SCATTERBONUS) continue;

            if (nt === WILD) stack.push({ row: nr, column: nc });
            else if (nt === baseType) stack.push({ row: nr, column: nc });
        }
    }

    return region;
}

/**
 * Detect all clusters ≥5 based on connectivity
 */
export function slotGetClusters(grid: Match3Grid) {
    const processed: boolean[][] = grid.map(r => r.map(() => false));
    const clusters: { type: number; positions: Match3Position[] }[] = [];

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {

            if (processed[r][c]) continue;

            const baseType = grid[r][c];

            // ❌ exclude WILD and SCATTERBONUS as cluster bases
            if (baseType === WILD || baseType === SCATTERBONUS) {
                processed[r][c] = true;
                continue;
            }

            const localVisited = grid.map(row => row.map(() => false));

            const region = floodFillCluster(
                grid,
                { row: r, column: c },
                baseType,
                localVisited
            );

            let real = 0;
            let wild = 0;

            for (const pos of region) {
                const t = grid[pos.row][pos.column];
                if (t === baseType) real++;
                else if (t === WILD) wild++;

                processed[pos.row][pos.column] = true;
            }

            const total = real + wild;

            if (total >= 5) {
                clusters.push({
                    type: baseType,
                    positions: region,
                });
            }
        }
    }

    return clusters;
}

/**
 * Evaluate wins INCLUDING wild multipliers.
 */
export function slotEvaluateClusterWins(
    grid: Match3Grid,
    bonusGrid: number[][]
) {
    const clusters = slotGetClusters(grid);
    const paytable = gameConfig.getPaytables();

    const results: ClusterWinResult[] = [];

    for (const cluster of clusters) {
        const entry = paytable.find(p => p.type === cluster.type);
        if (!entry) continue;

        const count = cluster.positions.length;

        const pattern = entry.patterns.find(
            p => count >= p.min && count <= p.max
        );
        if (!pattern) continue;

        let wildBonus = 0;

        for (const pos of cluster.positions) {
            const t = grid[pos.row][pos.column];
            if (t === WILD) {
                const m = bonusGrid[pos.row][pos.column] || 0;
                if (m > 0) wildBonus += m;
            }
        }

        const FinalMultiplier = wildBonus > 0 ? wildBonus : 1;

        results.push({
            type: cluster.type,
            count,
            multiplier: FinalMultiplier,
            positions: cluster.positions,
        });
    }

    return results;
}


export type ScatterResult = {
    count: number;
    positions: Match3Position[];
};

export function countScatterBonus(
    grid: number[][]
): ScatterResult {
    let count = 0;
    const positions: Match3Position[] = [];

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === SCATTERBONUS) {
                count++;
                positions.push({ row: r, column: c });
            }
        }
    }

    return { count, positions };
}


export function calculateTotalWin(
    results: ClusterWinResult[],
    betAmount: number
): number {
    const paytable = gameConfig.getPaytables();
    let totalWin = 0;

    results.forEach(r => {
        const payLedger = paytable.find(p => p.type === r.type);
        if (!payLedger) return;

        const payMatrix = payLedger.patterns.find(
            p => r.count >= p.min && r.count <= p.max
        );
        if (!payMatrix) return;

        const singleWin = (betAmount * payMatrix.multiplier) * r.multiplier; // (bet * equivalent multiplier) * TotalWildMultiplier
        totalWin += singleWin;
    });

    return totalWin;
}


/**
 * Flattens cluster win results into a single list of unique positions.
 * 
 * @param clusters Array of cluster result objects with `positions`
 * @returns Array<{ row: number, column: number }>
 */
export function flattenClusterPositions(
    clusters: { positions: { row: number, column: number }[] }[]
) {
    const seen = new Set<string>();
    const result: { row: number, column: number }[] = [];

    for (const cluster of clusters) {
        for (const pos of cluster.positions) {
            const key = pos.row + "-" + pos.column;

            if (!seen.has(key)) {
                seen.add(key);
                result.push({ row: pos.row, column: pos.column });
            }
        }
    }

    return result;
}


//  PIRATE GRID UTILITIES
export function mergeNonZero(
    current: number[][],
    incoming: number[][]
): number[][] {
    const rows = Math.max(current.length, incoming.length);
    const result: number[][] = [];

    for (let r = 0; r < rows; r++) {
        const curRow = current[r] ?? [];
        const inRow = incoming[r] ?? [];

        const cols = Math.max(curRow.length, inRow.length);
        const newRow: number[] = [];

        for (let c = 0; c < cols; c++) {
            const cur = curRow[c] ?? 0;
            const inc = inRow[c] ?? 0;

            if (cur === 0 && inc !== 0) {
                newRow[c] = inc;
            } else {
                newRow[c] = cur;
            }
        }

        result[r] = newRow;
    }

    return result;
}

export function mergeWildType(
    current: number[][],
    incoming: number[][]
): number[][] {
    const rows = Math.max(current.length, incoming.length);
    const result: number[][] = [];

    for (let r = 0; r < rows; r++) {
        const curRow = current[r] ?? [];
        const inRow = incoming[r] ?? [];

        const cols = Math.max(curRow.length, inRow.length);
        const newRow: number[] = [];

        for (let c = 0; c < cols; c++) {
            const cur = curRow[c] ?? 0;
            const inc = inRow[c] ?? 0;

            // ---- RULES ----
            if (cur === WILD) {
                // current already has sticky wild → keep locked
                newRow[c] = WILD;
            } else if (inc === WILD) {
                // incoming wants to add sticky wild → accept it
                newRow[c] = WILD;
            } else {
                // neither is wild → keep current unchanged
                newRow[c] = cur;
            }
        }

        result[r] = newRow;
    }

    return result;
}

export function mergeReels(
    current: number[][],
    incoming: number[][]
): number[][] {
    const rows = Math.max(current.length, incoming.length);
    const result: number[][] = [];

    for (let r = 0; r < rows; r++) {
        const curRow = current[r] ?? [];
        const inRow = incoming[r] ?? [];

        const cols = Math.max(curRow.length, inRow.length);
        const newRow: number[] = [];

        for (let c = 0; c < cols; c++) {
            const cur = curRow[c] ?? 0;
            const inc = inRow[c] ?? 0;

            // accept incoming unless current is locked (12)
            if (cur !== WILD) {
                newRow[c] = inc;
            } else {
                newRow[c] = cur;
            }
        }

        result[r] = newRow;
    }

    return result;
}

export function gridZeroReset(){
    return Array.from({ length: 5 }, () => Array(5).fill(0));
}

export function gridRandomTypeReset(){
    return Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => Math.floor(Math.random() * 10) + 1)
    );
}


export function initGrid<T>(rows: number, cols: number, fill: T): T[][] {
    return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

export function forEachCell(
    rows: number,
    cols: number,
    fn: (r: number, c: number) => void
) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) fn(r, c);
    }
}

export function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}
