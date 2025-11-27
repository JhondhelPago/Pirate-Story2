export class BetAPI {
    /**
     * Calls the backend API to perform a spin operation.
     * @param type - The type of spin ('n' for new, 'r' for refill, 'f' for free).
     * @returns {Promise<{reels: number[][]}>} A promise that resolves with the reels data.
     */
    static async spin(type: 'n' | 'r' | 'f'): Promise<{ reels: number[][] }> {
        try {
            // Define the URL of your Express server endpoint
            const url = 'http://192.168.68.116:3000/spin';

            // Make a GET request to the Express server
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // You might add an authorization header here if needed:
                    // 'Authorization': 'Bearer your_token_here',
                },
            });

            // Check if the network request was successful
            if (!response.ok) {
                // If the server responded with an error status (e.g., 404, 500)
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error occurred during spin');
            }

            // Parse the JSON response body
            const data: { reels: number[][] } = await response.json();

            // The 'type' parameter is not used in this fetch call but kept in signature
            console.log(`Spin type: ${type}`);

            return data;
        } catch (error: any) {
            // Log the original error for debugging
            console.error('Bet API spin failed:', error);

            const message = error?.message || 'Bet normal spin failed';
            throw new Error(message);
        }
    }
}
