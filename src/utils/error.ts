/** Display error message to user */
export function showErrorScreen(message: string) {
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; background: #000; color: #fff;">
            <div style="text-align: center;">
                <h1>Failed to Load</h1>
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
                    Retry
                </button>
            </div>
        </div>
    `;
}
