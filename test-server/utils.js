/**
 * Pauses execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
exports.waitFor = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
