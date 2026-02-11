import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    Block,
    getPathParamsFromUrl,
    getPathParamsFromPathParamsBlock,
    getDefaultIndentationForDictionaryBlockFields,
    getMethodBlockIfValid,
    DictionaryBlock,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
    Range,
    Position,
    LineBreakType,
    getSortedBlocksByPosition,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function updatePathParamsKeysToMatchUrl(
    docHelper: TextDocumentHelper,
    blocks: Block[],
): TextEdit | TextEdit[] {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const pathParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.PathParams,
    );

    if (
        !urlField ||
        !isDictionaryBlockSimpleField(urlField) ||
        pathParamsBlocks.length > 1
    ) {
        return [];
    }

    const listFromUrl = getPathParamsFromUrl(urlField.value);

    const listFromPathParamsBlock =
        pathParamsBlocks.length == 1
            ? getPathParamsFromPathParamsBlock(pathParamsBlocks[0])
            : undefined;

    if (
        doesTheFirstListContainEntriesTheSecondDoesNot(
            listFromUrl,
            listFromPathParamsBlock,
        )
    ) {
        const paramsToAdd = listFromPathParamsBlock
            ? listFromUrl.filter(
                  (paramFromUrl) =>
                      !listFromPathParamsBlock.includes(paramFromUrl),
              )
            : listFromUrl;

        return addMissingEntriesInPathParamsBlock(
            docHelper,
            paramsToAdd,
            blocks,
            pathParamsBlocks,
        );
    }

    if (
        listFromPathParamsBlock &&
        doesTheFirstListContainEntriesTheSecondDoesNot(
            listFromPathParamsBlock,
            listFromUrl,
        )
    ) {
        if (listFromUrl.length == 0) {
            return removeBlock(blocks, pathParamsBlocks[0]);
        }
        if (
            pathParamsBlocks[0].content.every((field) =>
                isDictionaryBlockSimpleField(field),
            )
        ) {
            const paramsToRemove = listFromPathParamsBlock.filter(
                (fromPathParamsBlock) =>
                    !listFromUrl.includes(fromPathParamsBlock),
            );

            return removeEntriesFromPathParamsBlock(
                paramsToRemove,
                pathParamsBlocks[0].content,
            );
        }
    }

    return [];
}

function doesTheFirstListContainEntriesTheSecondDoesNot(
    list1: string[],
    list2: string[] | undefined,
) {
    return (
        (list1.length > 0 && list2 == undefined) ||
        (list2 && list1.length > list2.length) ||
        (list2 &&
            list1.filter((entryFromList1) => !list2.includes(entryFromList1))
                .length > 0)
    );
}

function removeBlock(allBlocks: Block[], pathParamsBlock: DictionaryBlock) {
    const sortedBlocks = getSortedBlocksByPosition(allBlocks);

    const pathParamsBlockIndex = sortedBlocks.findIndex(
        ({ name }) => name == pathParamsBlock.name,
    );

    if (pathParamsBlockIndex > 0) {
        const previousBlockEnd =
            sortedBlocks[pathParamsBlockIndex - 1].contentRange.end;

        return TextEdit.del(
            new Range(previousBlockEnd, pathParamsBlock.contentRange.end),
        );
    }

    const nextBlockStart = sortedBlocks[1].nameRange.start;
    return TextEdit.del(new Range(new Position(0, 0), nextBlockStart));
}

function removeEntriesFromPathParamsBlock(
    paramsToRemove: string[],
    pathParamsBlockFields: DictionaryBlockSimpleField[],
) {
    const rangesToRemove = pathParamsBlockFields
        .filter(({ key }) => paramsToRemove.includes(key))
        .map(
            ({ valueRange }) =>
                new Range(
                    new Position(valueRange.start.line, 0),
                    new Position(valueRange.end.line + 1, 0),
                ),
        );

    return rangesToRemove.map((range) => TextEdit.del(range));
}

function addMissingEntriesInPathParamsBlock(
    docHelper: TextDocumentHelper,
    paramsToAdd: string[],
    allParsedBlocks: Block[],
    parsedPathParamsBlocks: DictionaryBlock[],
) {
    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    const blockContentToInsert = paramsToAdd
        .map(
            (urlSubstring) =>
                `${" ".repeat(
                    getDefaultIndentationForDictionaryBlockFields(),
                )}${urlSubstring}: `,
        )
        .join(lineBreak);

    if (parsedPathParamsBlocks.length == 0) {
        const methodBlock = getMethodBlockIfValid(
            allParsedBlocks,
        ) as DictionaryBlock;

        return TextEdit.insert(
            new Position(
                methodBlock.contentRange.end.line,
                methodBlock.contentRange.end.character + 1,
            ),
            `${lineBreak.repeat(2)}${
                RequestFileBlockName.PathParams
            } {${lineBreak}${blockContentToInsert}${lineBreak}}`,
        );
    }

    return TextEdit.insert(
        new Position(parsedPathParamsBlocks[0].contentRange.end.line, 0),
        `${blockContentToInsert}${lineBreak}`,
    );
}
