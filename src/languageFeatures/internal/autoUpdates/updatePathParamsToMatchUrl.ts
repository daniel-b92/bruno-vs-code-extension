import { Position, TextEditorEdit, TextDocument, EndOfLine } from "vscode";
import {
    getUrlFieldFromMethodBlock,
    getValidDictionaryBlocksWithName,
    RequestFileBlockName,
    RequestFileBlock,
    getPathParamsFromUrl,
    getExpectedMethodBlockUrlSubstringsForPathParamsBlock,
    getDefaultIndentationForDictionaryBlockFields,
} from "../../../shared";

export function updatePathParamsToMatchUrl(
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
                ? getExpectedMethodBlockUrlSubstringsForPathParamsBlock(
                      pathParamsBlocks[0]
                  )
                : undefined;

        if (
            (listFromUrl.length > 0 && listFromPathParamsBlock == undefined) ||
            (listFromPathParamsBlock &&
                listFromUrl.length > listFromPathParamsBlock.length) ||
            (listFromPathParamsBlock &&
                listFromUrl.filter(
                    (paramFromUrl) =>
                        !listFromPathParamsBlock.includes(paramFromUrl)
                ).length > 0)
        ) {
            const listToAdd = listFromPathParamsBlock
                ? listFromUrl.filter(
                      (paramFromUrl) =>
                          !listFromPathParamsBlock.includes(paramFromUrl)
                  )
                : listFromUrl;

            const lineBreak = document.eol == EndOfLine.LF ? "\n" : "\r\n";

            const blockContentToInsert = listToAdd
                .map(
                    (urlSubstring) =>
                        `${" ".repeat(
                            getDefaultIndentationForDictionaryBlockFields()
                        )}${urlSubstring.substring(2)}:`
                )
                .join(lineBreak);

            if (pathParamsBlocks.length == 0) {
                editBuilder.insert(
                    new Position(document.lineCount, 0),
                    `${lineBreak}${RequestFileBlockName.PathParams} {${lineBreak}${blockContentToInsert}${lineBreak}}`
                );
            } else {
                editBuilder.insert(
                    new Position(pathParamsBlocks[0].contentRange.end.line, 0),
                    `${blockContentToInsert}${lineBreak}`
                );
            }
        }
    }
}
