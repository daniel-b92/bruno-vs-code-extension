import { Range, Position, TextEditorEdit } from "vscode";
import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    getQueryParamsFromUrl,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getUrlSubstringForQueryParams,
    Block,
    mapPosition,
} from "../sharedred";

export function updateUrlToMatchQueryParams(
    editBuilder: TextEditorEdit,
    blocks: Block[]
) {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams
    );

    if (urlField && queryParamsBlocks.length == 1) {
        const queryParamsFromUrl = getQueryParamsFromUrl(urlField.value);
        const queryParamsFromQueryParamsBlock =
            getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlocks[0]);

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
                    mapPosition(urlField.valueRange.end)
                ),
                `${getUrlSubstringForQueryParams(
                    queryParamsFromQueryParamsBlock
                )}`
            );
        }
    }
}
