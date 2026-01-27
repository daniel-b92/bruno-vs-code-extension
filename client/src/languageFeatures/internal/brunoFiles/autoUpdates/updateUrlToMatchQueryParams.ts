import { Range, Position, TextEditorEdit } from "vscode";
import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    getQueryParamsFromUrl,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getUrlSubstringForQueryParams,
    Block,
    mapToVsCodePosition,
    isDictionaryBlockSimpleField,
} from "../../../../shared";

export function updateUrlToMatchQueryParams(
    editBuilder: TextEditorEdit,
    blocks: Block[],
) {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams,
    );

    if (
        urlField &&
        isDictionaryBlockSimpleField(urlField) &&
        queryParamsBlocks.length == 1 &&
        queryParamsBlocks[0].content.every((field) =>
            isDictionaryBlockSimpleField(field),
        )
    ) {
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
                ? urlField.valueRange.start.character +
                  urlField.value.indexOf("?")
                : urlField.valueRange.end.character;

            editBuilder.replace(
                new Range(
                    new Position(urlField.valueRange.start.line, startChar),
                    mapToVsCodePosition(urlField.valueRange.end),
                ),
                `${getUrlSubstringForQueryParams(
                    queryParamsFromQueryParamsBlock,
                )}`,
            );
        }
    }
}
