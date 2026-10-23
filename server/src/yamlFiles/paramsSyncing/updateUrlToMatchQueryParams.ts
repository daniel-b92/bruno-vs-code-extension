import {
    getQueryParamsFromUrl,
    getUrlSubstringForQueryParams,
    Range,
    TextDocumentHelper,
} from "@global_shared";
import { parseDocument } from "yaml";
import { TextEdit } from "vscode-languageserver";
import {
    getExpectedUrlQueryParams,
    YamlUrlParamsInfo,
} from "./getYamlUrlParamsInfo";
import { toYamlScalar } from "./editParamsEntries";

/**
 * Makes the query params of the URL match the enabled query params from `params`.
 * The quoting style of the URL is kept, unless the new URL cannot be written in that style.
 */
export function updateUrlToMatchQueryParams(
    docHelper: TextDocumentHelper,
    { url, enabledQueryParams }: YamlUrlParamsInfo,
): TextEdit[] {
    const expectedQueryParams = getExpectedUrlQueryParams(enabledQueryParams);
    const queryParamsFromUrl =
        getQueryParamsFromUrl(url.value) ?? new URLSearchParams();

    if (queryParamsFromUrl.toString() == expectedQueryParams.toString()) {
        return [];
    }

    const baseUrl = url.value.includes("?")
        ? url.value.substring(0, url.value.indexOf("?"))
        : url.value;
    const newUrlText = getScalarText(
        docHelper,
        url.valueRange,
        url.value,
        baseUrl + getUrlSubstringForQueryParams(expectedQueryParams),
    );

    return newUrlText === undefined
        ? []
        : [TextEdit.replace(url.valueRange, newUrlText)];
}

/** Returns `undefined`, if the style of the original scalar is not supported. */
function getScalarText(
    docHelper: TextDocumentHelper,
    range: Range,
    oldValue: string,
    newValue: string,
) {
    if (range.start.line != range.end.line) {
        return undefined;
    }

    const rawText = docHelper.getText(range);

    // Escape sequences in the original text would be lost, so only simple quoted scalars are supported.
    if (rawText.startsWith('"')) {
        return rawText == `"${oldValue}"`
            ? JSON.stringify(newValue)
            : undefined;
    }
    if (rawText.startsWith("'")) {
        return rawText == `'${oldValue}'`
            ? `'${newValue.replaceAll("'", "''")}'`
            : undefined;
    }

    // Excludes block scalars as well.
    return rawText == oldValue
        ? isValidPlainScalar(newValue)
            ? newValue
            : toYamlScalar(newValue)
        : undefined;
}

function isValidPlainScalar(value: string) {
    const document = parseDocument(`key: ${value}`);

    return document.errors.length == 0 && document.get("key") === value;
}
