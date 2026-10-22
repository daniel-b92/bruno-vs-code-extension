import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    getQueryParamsFromUrl,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getUrlSubstringForQueryParams,
    Block,
    isDictionaryBlockSimpleField,
    Range,
    Position,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function updateUrlToMatchQueryParams(
    blocks: Block[],
): TextEdit | TextEdit[] {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams,
    );

    if (
        !urlField ||
        urlField.disabled ||
        !isDictionaryBlockSimpleField(urlField) ||
        queryParamsBlocks.length != 1 ||
        !queryParamsBlocks[0].content.every((field) =>
            isDictionaryBlockSimpleField(field),
        )
    ) {
        return [];
    }

    const queryParamsFromUrl = getQueryParamsFromUrl(urlField.value);
    const queryParamsFromQueryParamsBlock =
        getExpectedUrlQueryParamsForQueryParamsBlock(
            queryParamsBlocks[0].content,
        );

    if (
        (!queryParamsFromUrl && queryParamsFromQueryParamsBlock.size > 0) ||
        (queryParamsFromUrl &&
            queryParamsFromUrl.toString() !=
                queryParamsFromQueryParamsBlock.toString())
    ) {
        const startChar = urlField.value.includes("?")
            ? urlField.valueRange.start.character + urlField.value.indexOf("?")
            : urlField.valueRange.end.character;

        return TextEdit.replace(
            new Range(
                new Position(urlField.valueRange.start.line, startChar),
                urlField.valueRange.end,
            ),
            `${getUrlSubstringForQueryParams(queryParamsFromQueryParamsBlock)}`,
        );
    }

    return [];
}
