import {
    getPathParamsFromUrl,
    getQueryParamsFromUrl,
    ParsedRequestFile,
    parseRequestFile,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import {
    getModifiedSide,
    ModifiedSide,
    ParamsAccessors,
} from "../../shared/urlParamsSyncing/getModifiedSide";
import {
    getExpectedUrlQueryParams,
    getYamlUrlParamsInfo,
} from "../paramsSyncing/getYamlUrlParamsInfo";
import { updateUrlToMatchQueryParams } from "../paramsSyncing/updateUrlToMatchQueryParams";
import { applyParamChanges } from "../paramsSyncing/editParamsEntries";
import { getQueryParamChanges } from "../paramsSyncing/updateQueryParamsToMatchUrl";
import { getPathParamChanges } from "../paramsSyncing/updatePathParamsToMatchUrl";

/**
 * Syncs the URL and the `params` of a request file when saving.
 * One side is only updated to match the other one, if exactly one of the two was modified since the last save.
 * If both sides were modified (or none), nothing is changed. The diagnostics and quick fixes can be used instead.
 *
 * @param lastSavedContent The content of the file before the current save (i.e. the content on disk).
 */
export function runUpdatesOnWillSave(
    lastSavedContent: string,
    newContent: string,
): TextEdit[] {
    const docHelper = new TextDocumentHelper(newContent);
    const parsed = parse(docHelper);
    const lastSaved = parse(new TextDocumentHelper(lastSavedContent));
    const info = parsed && getYamlUrlParamsInfo(parsed);

    if (!parsed || !lastSaved || !info) {
        return [];
    }

    const queryParamsSide = getModifiedSide(
        lastSaved,
        parsed,
        queryParamsAccessors,
    );

    if (queryParamsSide == ModifiedSide.Params) {
        return updateUrlToMatchQueryParams(docHelper, info);
    }

    // The values of path params only exist in `params`, so only `params` can be updated to match the URL.
    // The changes for query and path params are applied together, because they can affect the same entries of `params`.
    return applyParamChanges(docHelper, info, [
        ...(queryParamsSide == ModifiedSide.Url
            ? [getQueryParamChanges(info)]
            : []),
        ...(getModifiedSide(lastSaved, parsed, pathParamsAccessors) ==
        ModifiedSide.Url
            ? [getPathParamChanges(info)]
            : []),
    ]);
}

function parse(docHelper: TextDocumentHelper) {
    return parseRequestFile(docHelper, { continueOnSyntaxErrors: false })
        .result;
}

const queryParamsAccessors: ParamsAccessors<ParsedRequestFile> = {
    getUrl: (parsed) => parsed.properties.http?.properties.url?.value,
    fromUrl: (url) => getQueryParamsFromUrl(url)?.toString() ?? "",
    fromParams: (parsed) => {
        const info = getYamlUrlParamsInfo(parsed);

        return (
            info &&
            getExpectedUrlQueryParams(info.enabledQueryParams).toString()
        );
    },
};

const pathParamsAccessors: ParamsAccessors<ParsedRequestFile> = {
    getUrl: queryParamsAccessors.getUrl,
    fromUrl: (url) => getPathParamsFromUrl(url).join("/"),
    fromParams: (parsed) =>
        getYamlUrlParamsInfo(parsed)
            ?.enabledPathParams.map(({ name }) => name)
            .join("/"),
};
