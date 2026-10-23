import {
    getQueryParamEntriesFromUrl,
    getQueryParamsFromUrl,
    HttpParamType,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import { applyParamChanges, ParamChanges } from "./editParamsEntries";
import {
    getExpectedUrlQueryParams,
    YamlUrlParamsInfo,
} from "./getYamlUrlParamsInfo";

/**
 * Counterpart to `updateUrlToMatchQueryParams`: Makes the enabled query params from `params` match the URL.
 * Disabled entries and path params are kept.
 */
export function updateQueryParamsToMatchUrl(
    docHelper: TextDocumentHelper,
    info: YamlUrlParamsInfo,
): TextEdit[] {
    return applyParamChanges(docHelper, info, [getQueryParamChanges(info)]);
}

export function getQueryParamChanges({
    url,
    enabledQueryParams,
}: YamlUrlParamsInfo): ParamChanges {
    const queryParamsFromUrl =
        getQueryParamsFromUrl(url.value) ?? new URLSearchParams();

    if (
        queryParamsFromUrl.toString() ==
        getExpectedUrlQueryParams(enabledQueryParams).toString()
    ) {
        return { remove: [], add: [] };
    }

    return {
        remove: enabledQueryParams.map(({ entry }) => entry),
        // The values are kept exactly as they are written in the URL.
        add: getQueryParamEntriesFromUrl(url.value).map(([name, value]) => ({
            name,
            value,
            type: HttpParamType.Query,
        })),
        addInPlaceOf: enabledQueryParams[0]?.entry,
    };
}
