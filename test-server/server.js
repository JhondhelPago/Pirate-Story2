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

let storage = [];
let scatterReels = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 1, 8, 3],
    [4, 5, 8, 7, 8],
    [4, 7, 9, 8, 8],
];

// let winReels = [
//     [1, 4, 3, 2, 5],
//     [6, 2, 2, 2, 10],
//     [1, 1, 12, 12, 10],
//     [1, 3, 1, 10, 10],
//     [5, 11, 2, 10, 10],
// ];

let winReels = [
    [1, 4, 3, 2, 5],
    [6, 6, 2, 2, 12],
    [4, 12, 4, 12, 4],
    [1, 3, 12, 1, 10],
    [5, 11, 12, 2, 10],
];

let grandReels = [
    [11, 4, 2, 2, 5],
    [6, 2, 2, 12, 10],
    [1, 9, 12, 12, 9],
    [12, 12, 9, 9, 12],
    [3, 3, 2, 2, 12],
];

app.get('/spin', async (req, res) => {
    await utils.waitFor(delay); // 1 sec

    // Generate 5 reels, each with 5 random symbols (1-12)
    //const reels = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => getRandomInt(1, 12)));
    const reels = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => {
        let n = getRandomInt(1, 12);  // now includes 12
        while (n === 11) {
        n = getRandomInt(1, 12);
        }
        return n;
    })
    );


    
    //const reels = winReels;

    const bonusReels = reels.map(reel => {
        const multiplierOptions = [2, 3, 5];
        const randomMultiplier = multiplierOptions[Math.floor(Math.random() * multiplierOptions.length)];
        // return reel.map(symbol => (symbol === 11 || symbol === 12 ? randomMultiplier : 0)); // type shoild only be generetedby the initail spin, configure by the server
        return reel.map(symbol => (symbol === 12 ? randomMultiplier : 0));
    })
    

    console.log('Generated Reels:', reels, bonusReels);

    res.json({
        // reels: grandReels,
        reels: reels,
        bonusReels: bonusReels,
    });
});

app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});
