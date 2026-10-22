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

/**
 * Makes the query params of the URL match the enabled entries of the query params block.
 * If the query params block is missing, all query params are removed from the URL.
 */
export function updateUrlToMatchQueryParams(
    blocks: Block[],
): TextEdit | TextEdit[] {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const allQueryParamsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.QueryParams,
    );
    const validQueryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams,
    );
    const queryParamsBlockFields =
        validQueryParamsBlocks.length == 1
            ? validQueryParamsBlocks[0].content
            : [];

    if (
        !urlField ||
        urlField.disabled ||
        !isDictionaryBlockSimpleField(urlField) ||
        allQueryParamsBlocks.length > 1 ||
        // An invalid query params block must not be treated like a missing one.
        validQueryParamsBlocks.length != allQueryParamsBlocks.length ||
        !queryParamsBlockFields.every((field) =>
            isDictionaryBlockSimpleField(field),
        )
    ) {
        return [];
    }

    const queryParamsFromUrl = getQueryParamsFromUrl(urlField.value);
    // Without a query params block, there are no fields and therefore all query params are removed from the URL.
    const queryParamsFromQueryParamsBlock =
        getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlockFields);

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
