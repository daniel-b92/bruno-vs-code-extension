export function getQueryParamsFromUrl(url: string) {
    if (!url.includes("?")) {
        return undefined;
    }

    return new URLSearchParams(url.substring(url.indexOf("?")));
}
