export class BetAPI {
    /**
     * Calls the backend API to perform a spin operation.
     * @param type - The type of spin ('n' for new, 'r' for refill, 'f' for free).
     * @returns {Promise<{reels: number[][]}>} A promise that resolves with the reels data.
     */
    static async spin(type: 'n' | 'r' | 'f'): Promise<{ reels: number[][], bonusReels: number[][] }> {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Define the URL of your Express server endpoint
            const url = 'http://192.168.68.121:3000/spin';

            // Make a GET request to the Express server
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // Check if the network request was successful
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error occurred during spin');
            }

            // Parse the JSON response body
            const data: { reels: number[][], bonusReels: number[][] } = await response.json();

            console.log(`Spin type: ${type}`);

            return data;
        } catch (error: any) {
            console.error('Bet API spin failed:', error);

            const message = error?.message || 'Bet normal spin failed';
            throw new Error(message);
        }
    }
}
