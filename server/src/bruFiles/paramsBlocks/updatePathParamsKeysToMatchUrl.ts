import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    Block,
    getPathParamsFromUrl,
    getPathParamsFromPathParamsBlock,
    getDefaultIndentationForDictionaryBlockFields,
    DictionaryBlock,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
    Range,
    Position,
    LineBreakType,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import {
    insertNewBlockAfterMethodBlock,
    removeBlock,
} from "./dictionaryBlockEdits";

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
        urlField.disabled ||
        pathParamsBlocks.length > 1
    ) {
        return [];
    }

    const listFromUrl = getPathParamsFromUrl(urlField.value);

    const listFromPathParamsBlock =
        pathParamsBlocks.length == 1
            ? getPathParamsFromPathParamsBlock(pathParamsBlocks[0])
            : undefined;

    const edits: TextEdit[] = [];

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

        edits.push(
            addMissingEntriesInPathParamsBlock(
                docHelper,
                paramsToAdd,
                blocks,
                pathParamsBlocks,
            ),
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
            return removeBlock(docHelper, pathParamsBlocks[0]);
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

            edits.push(
                ...removeEntriesFromPathParamsBlock(
                    paramsToRemove,
                    pathParamsBlocks[0].content,
                ),
            );
        }
    }

    return edits;
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

    const linesToInsert = paramsToAdd.map(
        (urlSubstring) =>
            `${" ".repeat(
                getDefaultIndentationForDictionaryBlockFields(),
            )}${urlSubstring}: ${lineBreak}`,
    );

    if (parsedPathParamsBlocks.length == 0) {
        return insertNewBlockAfterMethodBlock(
            allParsedBlocks,
            RequestFileBlockName.PathParams,
            linesToInsert,
            lineBreak,
        );
    }

    return TextEdit.insert(
        new Position(parsedPathParamsBlocks[0].contentRange.end.line, 0),
        linesToInsert.join(""),
    );
}
