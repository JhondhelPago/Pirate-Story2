const express = require('express');
const cors = require('cors');
const utils = require('./utils');
const app = express();

app.use(cors('*'));

const port = 3000;
const delay = 1;
/**
 * Generate a random number between min and max (inclusive)
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Weighted pick helper
 * weights: [w1, w2, ...] for outcomes 1..N
 */
function pickWeightedIndex(weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        if (rand < weights[i]) return i; // 0-based index
        rand -= weights[i];
    }
    return weights.length - 1;
}

/**
 * Decide how many 11s to place (1-5)
 * Requirement: rarity of having exactly 2 of type 11 should be ~ 1 in 10 spins (10%).
 */
function decideNum11s() {
    // probabilities for 1,2,3,4,5 occurrences (sum = 100)
    // ✅ exactly 2 occurs ~10% (≈ 1 in 10 spins)
    const weights = [70, 10, 8, 7, 5];
    return pickWeightedIndex(weights) + 1; // => 1..5
}

/**
 * Generate bonus reels
 * Each reel is 5x5, containing mostly 0s and 1-5 occurrences of 11
 * (applies adjusted type 11 rarity here too)
 */
function generateBonusReels() {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(0));

    const num11s = decideNum11s();

    // Randomly assign '11's to positions
    const positions = new Set();
    while (positions.size < num11s) {
        const x = getRandomInt(0, 4);
        const y = getRandomInt(0, 4);
        const key = `${x},${y}`;
        if (!positions.has(key)) {
            positions.add(key);
            grid[y][x] = 11;
        }
    }

    return grid;
}

/**
 * Generate reels (5x5) and control how many 11s appear.
 * NOTE: Applies ONLY to reels (and bonusReels). Multiplier reels are excluded.
 */
function generateReels() {
    // Fill with random symbols 1-12 EXCLUDING 11 first
    const grid = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => {
            let n = getRandomInt(1, 12);
            while (n === 11) n = getRandomInt(1, 12);
            return n;
        })
    );

    // Now place 1-5 occurrences of 11 with tuned rarity
    const num11s = decideNum11s();

    const positions = new Set();
    while (positions.size < num11s) {
        const x = getRandomInt(0, 4);
        const y = getRandomInt(0, 4);
        const key = `${x},${y}`;
        if (!positions.has(key)) {
            positions.add(key);
            grid[y][x] = 11;
        }
    }

    return grid;
}


let storage = [];
let scatterReels = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 1, 8, 3],
    [4, 5, 8, 7, 8],
    [4, 7, 9, 8, 8],
];

let winReels = [
    [1, 4, 3, 2, 10],
    [12, 12, 9, 9, 12],
    [8, 10, 8, 12, 10],
    [8, 8, 12, 1, 10],
    [8, 11, 3, 1, 10],
];

let bonusReels = [
    [11, 0, 0, 0, 0],
    [0, 0, 0, 11, 0],
    [0, 0, 11, 0, 0],
    [0, 0, 11, 0, 11],
    [0, 0, 11, 0, 0]
];

let initialReels = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 11],
    [11, 10, 1, 8, 3],
    [4, 5, 8, 11, 8],
    [4, 7, 9, 8, 8],
];

let multiplier = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
];

app.get('/spin', async (req, res) => {

    // ✅ Generate reels with controlled type 11 rarity (applies ONLY to reels)
    const reels = generateReels();

    // ❌ Do NOT apply type 11 logic here; multiplier reels are excluded (only symbol === 12)
    const multiplier = reels.map(reel => {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier = multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];
        // return reel.map(symbol => (symbol === 11 || symbol === 12 ? randomMultiplier : 0)); // type shoild only be generetedby the initail spin, configure by the server
        return reel.map(symbol => (symbol === 12 ? randomMultiplier : 0));
    });

    // ✅ Bonus reels also use the same tuned rarity
    const bonus = generateBonusReels();

    console.log('Generated Reels:', reels, multiplier, bonus);

    res.json({
        // reels: grandReels,
        reels: reels,
        //reels: initialReels,
        multiplierReels: multiplier,
        bonusReels: bonus
    });
});

app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});
