/** Get url parameter by name */
export function getUrlParam(param: string) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get(param);
}

/** Get url parameter by name and ensure value as number, if that can be converted, or null otherwise */
export function getUrlParamNumber(param: string) {
    const value = getUrlParam(param);
    if (!value) return null;
    const valueNumber = Number(value);
    if (isNaN(valueNumber)) return null;
    return valueNumber;
}


// token query parameter remover
export function updateUrlSettings(lang: string, currency: string) {
    const url = new URL(window.location.href);

    let changed = false;

    // Remove token from URL if present
    if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
        changed = true;
    }

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
