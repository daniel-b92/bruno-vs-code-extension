import { getPathParamsFromUrl } from "./getPathParamsFromUrl";
import { getQueryParamEntriesFromUrl } from "./getQueryParamEntriesFromUrl";

export function getParamsFromUrl(url: string) {
    return {
        query: getQueryParamEntriesFromUrl(url).map(([name, value]) => ({
            name,
            value,
        })),
        // Duplicate path params would result in duplicate keys in the generated request file.
        path: [...new Set(getPathParamsFromUrl(url))].map((name) => ({
            name,
            value: "",
        })),
    };
}
