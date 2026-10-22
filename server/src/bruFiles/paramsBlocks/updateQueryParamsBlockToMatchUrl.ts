import {
    getUrlFieldFromMethodBlock,
    RequestFileBlockName,
    Block,
    getDefaultIndentationForDictionaryBlockFields,
    DictionaryBlock,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
    Range,
    Position,
    LineBreakType,
    getQueryParamEntriesFromUrl,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import {
    insertNewBlockAfterMethodBlock,
    removeBlock,
} from "./dictionaryBlockEdits";

/**
 * Counterpart to `updateUrlToMatchQueryParams`: Makes the enabled entries of the query params block match the URL.
 * Disabled entries are kept, since they are not part of the URL.
 */
export function updateQueryParamsBlockToMatchUrl(
    docHelper: TextDocumentHelper,
    blocks: Block[],
): TextEdit[] {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    // Not using `getValidDictionaryBlocksWithName` here, since that would ignore invalid blocks and an additional block would be inserted next to them.
    const queryParamsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.QueryParams,
    );

    if (
        !urlField ||
        urlField.disabled ||
        !isDictionaryBlockSimpleField(urlField) ||
        queryParamsBlocks.length > 1 ||
        (queryParamsBlocks.length == 1 &&
            !isEmptyOrSimpleFieldsOnlyBlock(queryParamsBlocks[0]))
    ) {
        return [];
    }

    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;
    const linesForUrlParams = getQueryParamEntriesFromUrl(urlField.value).map(
        ([key, value]) =>
            `${" ".repeat(
                getDefaultIndentationForDictionaryBlockFields(),
            )}${key}: ${value}${lineBreak}`,
    );

    if (queryParamsBlocks.length == 0) {
        return linesForUrlParams.length > 0
            ? [
                  insertNewBlockAfterMethodBlock(
                      blocks,
                      RequestFileBlockName.QueryParams,
                      linesForUrlParams,
                      lineBreak,
                  ),
              ]
            : [];
    }

    const queryParamsBlock = queryParamsBlocks[0] as DictionaryBlock;

    // Empty dictionary blocks are invalid, so the block needs to be removed if no entries would be left.
    if (
        linesForUrlParams.length == 0 &&
        getEnabledFields(queryParamsBlock).length ==
            queryParamsBlock.content.length
    ) {
        return [removeBlock(docHelper, queryParamsBlock)];
    }

    return replaceEnabledFields(queryParamsBlock, linesForUrlParams.join(""));
}

function isEmptyOrSimpleFieldsOnlyBlock(block: Block) {
    return (
        Array.isArray(block.content) &&
        block.content.every((field) => isDictionaryBlockSimpleField(field))
    );
}

function getEnabledFields(queryParamsBlock: DictionaryBlock) {
    return (queryParamsBlock.content as DictionaryBlockSimpleField[]).filter(
        ({ disabled }) => !disabled,
    );
}

function replaceEnabledFields(
    queryParamsBlock: DictionaryBlock,
    newContent: string,
) {
    const enabledFields = getEnabledFields(queryParamsBlock);

    if (enabledFields.length == 0) {
        return newContent.length > 0
            ? [
                  TextEdit.insert(
                      new Position(queryParamsBlock.contentRange.end.line, 0),
                      newContent,
                  ),
              ]
            : [];
    }

    const rangesToReplace = enabledFields.map(
        ({ keyRange, valueRange }) =>
            new Range(
                new Position(keyRange.start.line, 0),
                new Position(valueRange.end.line + 1, 0),
            ),
    );

    // The new entries take the place of the first enabled field, all other enabled fields are removed.
    return rangesToReplace.map((range, index) =>
        index == 0 ? TextEdit.replace(range, newContent) : TextEdit.del(range),
    );
}
