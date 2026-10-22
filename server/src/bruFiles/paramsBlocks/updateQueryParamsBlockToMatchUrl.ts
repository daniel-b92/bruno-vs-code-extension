import {
    getUrlFieldFromMethodBlock,
    RequestFileBlockName,
    Block,
    getDefaultIndentationForDictionaryBlockFields,
    getMethodBlockIfValid,
    DictionaryBlock,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
    Range,
    Position,
    LineBreakType,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

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
    const linesForUrlParams = getEntriesFromUrl(urlField.value).map(
        ([key, value]) =>
            `${" ".repeat(
                getDefaultIndentationForDictionaryBlockFields(),
            )}${key}: ${value}${lineBreak}`,
    );

    if (queryParamsBlocks.length == 0) {
        return linesForUrlParams.length > 0
            ? [insertNewBlock(blocks, linesForUrlParams.join(""), lineBreak)]
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

function getEntriesFromUrl(url: string) {
    if (!url.includes("?")) {
        return [];
    }

    // Not using `URLSearchParams` here to keep the values exactly as they are written in the URL.
    return url
        .substring(url.indexOf("?") + 1)
        .split("&")
        .filter((param) => param != "")
        .map((param): [string, string] => {
            const indexOfSeparator = param.indexOf("=");

            return indexOfSeparator < 0
                ? [param, ""]
                : [
                      param.substring(0, indexOfSeparator),
                      param.substring(indexOfSeparator + 1),
                  ];
        });
}

function insertNewBlock(
    allBlocks: Block[],
    blockContentToInsert: string,
    lineBreak: string,
) {
    const methodBlock = getMethodBlockIfValid(allBlocks) as DictionaryBlock;

    return TextEdit.insert(
        new Position(
            methodBlock.contentRange.end.line,
            methodBlock.contentRange.end.character + 1,
        ),
        `${lineBreak.repeat(2)}${
            RequestFileBlockName.QueryParams
        } {${lineBreak}${blockContentToInsert}}`,
    );
}

function removeBlock(docHelper: TextDocumentHelper, block: DictionaryBlock) {
    const startLine = block.nameRange.start.line;
    const endLine = block.contentRange.end.line;
    // Also remove the blank line separating the block from the previous one.
    const firstLineToRemove =
        startLine > 0 && docHelper.getLineByIndex(startLine - 1).trim() == ""
            ? startLine - 1
            : startLine;
    const isLastLine = endLine + 1 >= docHelper.getLineCount();

    return TextEdit.del(
        new Range(
            new Position(firstLineToRemove, 0),
            isLastLine
                ? new Position(
                      endLine,
                      docHelper.getLineByIndex(endLine).length,
                  )
                : new Position(endLine + 1, 0),
        ),
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
