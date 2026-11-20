export function getUrlSubstringForQueryParams(queryParams: URLSearchParams) {
    const result = "";

    if (queryParams.size == 0) {
        return result;
    }

    return `?${Array.from(queryParams.entries())
        .map((values) => `${values[0]}=${values[1]}`)
        .join("&")}`;
}
