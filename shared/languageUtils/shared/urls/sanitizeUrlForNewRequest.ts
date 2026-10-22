import { getQueryParamEntriesFromUrl } from "./getQueryParamEntriesFromUrl";

/**
 * Makes a URL (e.g. from the collection presets) safe to be written into a new request file:
 * Line breaks are removed and query params are trimmed, so that they stay unchanged when the file is parsed again.
 * Query params with an empty name or a name containing a colon cannot be represented in a `params:query` block and are dropped.
 */
export function sanitizeUrlForNewRequest(url: string) {
    const urlWithoutLineBreaks = url.replace(/[\r\n]/g, "");

    if (!urlWithoutLineBreaks.includes("?")) {
        return urlWithoutLineBreaks;
    }

    const queryParams = getQueryParamEntriesFromUrl(urlWithoutLineBreaks)
        .map(([key, value]): [string, string] => [key.trim(), value.trim()])
        .filter(([key]) => key != "" && !key.includes(":"))
        .map(([key, value]) => (value == "" ? key : `${key}=${value}`));

    const baseUrl = urlWithoutLineBreaks.substring(
        0,
        urlWithoutLineBreaks.indexOf("?"),
    );

    return queryParams.length > 0
        ? `${baseUrl}?${queryParams.join("&")}`
        : baseUrl;
}
