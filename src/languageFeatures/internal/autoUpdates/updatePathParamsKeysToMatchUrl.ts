import { Position, TextEditorEdit, TextDocument, Range } from "vscode";
import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    RequestFileBlock,
    getPathParamsFromUrl,
    getPathParamsFromPathParamsBlock,
    getDefaultIndentationForDictionaryBlockFields,
    getMethodBlockIfValid,
    DictionaryBlock,
    getLineBreakForDocument,
} from "../../../shared";
import { getSortedBlocksByPosition } from "../diagnostics/shared/util/getSortedBlocksByPosition";

export function updatePathParamsKeysToMatchUrl(
    document: TextDocument,
    editBuilder: TextEditorEdit,
    blocks: RequestFileBlock[]
) {
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const pathParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.PathParams
    );

    if (urlField && pathParamsBlocks.length <= 1) {
        const listFromUrl = getPathParamsFromUrl(urlField.value);

        const listFromPathParamsBlock =
            pathParamsBlocks.length == 1
                ? getPathParamsFromPathParamsBlock(pathParamsBlocks[0])
                : undefined;

        if (
            doesTheFirstListContainEntriesTheSecondDoesNot(
                listFromUrl,
                listFromPathParamsBlock
            )
        ) {
            const paramsToAdd = listFromPathParamsBlock
                ? listFromUrl.filter(
                      (paramFromUrl) =>
                          !listFromPathParamsBlock.includes(paramFromUrl)
                  )
                : listFromUrl;

            addMissingEntriesInPathParamsBlock(
                document,
                editBuilder,
                paramsToAdd,
                blocks,
                pathParamsBlocks
            );
        } else if (
            listFromPathParamsBlock &&
            doesTheFirstListContainEntriesTheSecondDoesNot(
                listFromPathParamsBlock,
                listFromUrl
            )
        ) {
            if (listFromUrl.length == 0) {
                removeBlock(editBuilder, blocks, pathParamsBlocks[0]);
            } else {
                const paramsToRemove = listFromPathParamsBlock.filter(
                    (fromPathParamsBlock) =>
                        !listFromUrl.includes(fromPathParamsBlock)
                );

                removeEntriesFromPathParamsBlock(
                    document,
                    editBuilder,
                    paramsToRemove,
                    pathParamsBlocks[0]
                );
            }
        }
    }
}

function doesTheFirstListContainEntriesTheSecondDoesNot(
    list1: string[],
    list2: string[] | undefined
) {
    return (
        (list1.length > 0 && list2 == undefined) ||
        (list2 && list1.length > list2.length) ||
        (list2 &&
            list1.filter((entryFromList1) => !list2.includes(entryFromList1))
                .length > 0)
    );
}

function removeBlock(
    editBuilder: TextEditorEdit,
    allBlocks: RequestFileBlock[],
    pathParamsBlock: DictionaryBlock
) {
    const sortedBlocks = getSortedBlocksByPosition(allBlocks);

    const pathParamsBlockIndex = sortedBlocks.findIndex(
        ({ name }) => name == pathParamsBlock.name
    );

    if (pathParamsBlockIndex > 0) {
        const previousBlockEnd =
            sortedBlocks[pathParamsBlockIndex - 1].contentRange.end;

        editBuilder.delete(
            new Range(previousBlockEnd, pathParamsBlock.contentRange.end)
        );
    } else {
        const nextBlockStart = sortedBlocks[1].nameRange.start;

        editBuilder.delete(new Range(new Position(0, 0), nextBlockStart));
    }
}

function removeEntriesFromPathParamsBlock(
    document: TextDocument,
    editBuilder: TextEditorEdit,
    paramsToRemove: string[],
    pathParamsBlock: DictionaryBlock
) {
    const rangesToRemove = pathParamsBlock.content
        .filter(({ key }) => paramsToRemove.includes(key))
        .map(
            ({ valueRange }) =>
                new Range(
                    new Position(valueRange.start.line, 0),
                    document.lineAt(
                        valueRange.end.line
                    ).rangeIncludingLineBreak.end
                )
        );

    for (const range of rangesToRemove) {
        editBuilder.delete(range);
    }
}

function addMissingEntriesInPathParamsBlock(
    document: TextDocument,
    editBuilder: TextEditorEdit,
    paramsToAdd: string[],
    allParsedBlocks: RequestFileBlock[],
    parsedPathParamsBlocks: DictionaryBlock[]
) {
    const lineBreak = getLineBreakForDocument(document);

    const blockContentToInsert = paramsToAdd
        .map(
            (urlSubstring) =>
                `${" ".repeat(
                    getDefaultIndentationForDictionaryBlockFields()
                )}${urlSubstring}: `
        )
        .join(lineBreak);

    if (parsedPathParamsBlocks.length == 0) {
        const methodBlock = getMethodBlockIfValid(
            allParsedBlocks
        ) as DictionaryBlock;

        editBuilder.insert(
            new Position(
                methodBlock.contentRange.end.line,
                methodBlock.contentRange.end.character + 1
            ),
            `${lineBreak.repeat(2)}${
                RequestFileBlockName.PathParams
            } {${lineBreak}${blockContentToInsert}${lineBreak}}`
        );
    } else {
        editBuilder.insert(
            new Position(parsedPathParamsBlocks[0].contentRange.end.line, 0),
            `${blockContentToInsert}${lineBreak}`
        );
    }
}
