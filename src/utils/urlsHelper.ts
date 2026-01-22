export function updateUrlSettings(lang: string, currency: string) {
    const url = new URL(window.location.href);

    let changed = false;

    if (!url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        changed = true;
    }

    if (!url.searchParams.has('cur')) {
        url.searchParams.set('cur', currency);
        changed = true;
    }

    if (changed) {
        window.history.replaceState({}, '', url.toString());
    }
}
