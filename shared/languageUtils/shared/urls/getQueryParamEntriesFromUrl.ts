/**
 * Returns the query params from the URL as `[key, value]` entries.
 * Not using `URLSearchParams` here to keep the values exactly as they are written in the URL.
 */
export function getQueryParamEntriesFromUrl(url: string) {
    if (!url.includes("?")) {
        return [];
    }

    return url
        .substring(url.indexOf("?") + 1)
        .split("&")
        .filter((param) => param != "")
        .map((param): [string, string] => {
            const indexOfSeparator = param.indexOf("=");

            return indexOfSeparator < 0
                ? [param, ""]
                : [
                      param.substring(0, indexOfSeparator),
                      param.substring(indexOfSeparator + 1),
                  ];
        });
}
