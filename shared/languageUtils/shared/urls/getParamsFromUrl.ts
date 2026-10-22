import { getPathParamsFromUrl } from "./getPathParamsFromUrl";
import { getQueryParamEntriesFromUrl } from "./getQueryParamEntriesFromUrl";

export function getParamsFromUrl(url: string) {
    return {
        query: getQueryParamEntriesFromUrl(url).map(([name, value]) => ({
            name,
            value,
        })),
        path: getPathParamsFromUrl(url).map((name) => ({ name, value: "" })),
    };
}
