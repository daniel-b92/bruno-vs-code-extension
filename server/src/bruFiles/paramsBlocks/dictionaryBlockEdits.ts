import {
    Block,
    DictionaryBlock,
    getMethodBlockIfValid,
    Position,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

/**
 * Inserts a new block with the given name directly after the method block.
 *
 * @param linesToInsert The lines of the block content, each including its trailing line break.
 */
export function insertNewBlockAfterMethodBlock(
    allBlocks: Block[],
    blockName: RequestFileBlockName,
    linesToInsert: string[],
    lineBreak: string,
) {
    const methodBlock = getMethodBlockIfValid(allBlocks) as DictionaryBlock;

    return TextEdit.insert(
        new Position(
            methodBlock.contentRange.end.line,
            methodBlock.contentRange.end.character + 1,
        ),
        `${lineBreak.repeat(2)}${blockName} {${lineBreak}${linesToInsert.join(
            "",
        )}}`,
    );
}

export function removeBlock(
    docHelper: TextDocumentHelper,
    block: DictionaryBlock,
) {
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
