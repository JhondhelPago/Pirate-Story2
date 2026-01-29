export type CurrencyType = 'US' | 'KRW' | 'PHP';

export function getCurrencySymbol(type: CurrencyType): string {
    switch (type) {
        case 'US':
            return '$';
        case 'KRW':
            return '₩';
        case 'PHP':
            return '₱';
        default:
            return '$';
    }
}
