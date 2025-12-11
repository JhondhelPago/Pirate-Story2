const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
    minimumFractionDigits: 2,
});

// Function to format currency
export function formatCurrency(amount: number, currency: string = 'usd') {
    // Attempt to create a formatter for the provided currency
    try {
        const formatter = new Intl.NumberFormat('en-US', {
            currency: currency,
            style: 'currency',
            minimumFractionDigits: 2,
        });
        // Try formatting an amount to ensure the currency code is valid
        formatter.format(0);
        return formatter.format(amount);
    } catch (e) {
        console.warn(`Invalid currency code: ${currency}. Falling back to USD.`);
        // Fall back to the predefined USD formatter if the currency code is invalid
        return CURRENCY_FORMATTER.format(amount);
    }
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatNumber(number: number) {
    return NUMBER_FORMATTER.format(number);
}
