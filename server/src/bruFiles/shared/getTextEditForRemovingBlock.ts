import { Block, Position, Range, TextDocumentHelper } from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function getTextEditForRemovingBlock(
    docHelper: TextDocumentHelper,
    block: Block,
): TextEdit | undefined {
    const firstBlockLine = block.nameRange.start.line;
    const blankLinePattern = /^\s*$/m;

    const fullBlockRange = getFullBlockRange(docHelper, block);
    if (fullBlockRange == undefined) {
        return undefined;
    }

    // Remove empty lines between block and previous block, too.
    const firstLineToRemove = docHelper
        .getAllLines()
        .filter(({ index }) => index <= firstBlockLine)
        .reverse()
        .find(({ content, index }) => {
            if (index == 0) {
                return true;
            }

            const previousLineContent = docHelper.getLineByIndex(index - 1);

            return (
                (blankLinePattern.test(content) || index == firstBlockLine) &&
                !blankLinePattern.test(previousLineContent)
            );
        });

    if (!firstLineToRemove) {
        return { newText: "", range: fullBlockRange };
    }

    const rangeStart =
        firstLineToRemove.index == 0
            ? new Position(0, 0)
            : (docHelper.getRangeForLine(firstLineToRemove.index - 1)?.end ??
              new Position(firstLineToRemove.index, 0));

    return {
        newText: "",
        range: new Range(rangeStart, fullBlockRange.end),
    };
}

function getFullBlockRange(
    docHelper: TextDocumentHelper,
    blockToReplace: Block,
) {
    const blockStartLine = blockToReplace.nameRange.start.line;
    const blockEndLine = blockToReplace.contentRange.end.line;
    const fullBlockEnd = docHelper.getRangeForLine(blockEndLine)?.end;

    return fullBlockEnd
        ? new Range(
              new Position(blockStartLine, 0),
              new Position(blockEndLine, fullBlockEnd.character),
          )
        : undefined;
}
