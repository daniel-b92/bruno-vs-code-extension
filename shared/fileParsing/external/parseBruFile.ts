import { getBlockContent } from "../internal/getBlockContent";
import {
    getBlockType,
    Position,
    Range,
    DictionaryBlockSimpleField,
    Block,
    TextOutsideOfBlocks,
    ArrayBlockField,
    getBlocksWithoutVariableSupport,
    TextDocumentHelper,
    getNonBlockSpecificBlockStartPattern,
} from "../..";
import { findBlockEnd } from "../internal/findBlockEnd";

export const parseBruFile = (docHelper: TextDocumentHelper) => {
    const result: {
        blocks: Block[];
        textOutsideOfBlocks: TextOutsideOfBlocks[];
    } = { blocks: [], textOutsideOfBlocks: [] };

    let lineIndex = 0;
    let currentTextOutsideOfBlocksStart: Position | undefined;

    while (lineIndex < docHelper.getLineCount()) {
        const line = docHelper.getLineByIndex(lineIndex);
        const matches = getNonBlockSpecificBlockStartPattern().exec(line);

        if (matches && matches.length > 0) {
            if (currentTextOutsideOfBlocksStart != undefined) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStart,
                        new Position(lineIndex, matches.index),
                        docHelper,
                    ),
                );

                currentTextOutsideOfBlocksStart = undefined;
            }

            const blockName = matches[1];
            const blockType = getBlockType(matches[0], blockName);
            const blockEndPosition = findBlockEnd(
                docHelper,
                lineIndex + 1,
                blockType,
            );

            const blockContent = blockEndPosition
                ? getBlockContent(
                      docHelper,
                      new Range(
                          // The block content starts in the line after the one with the block name.
                          new Position(lineIndex + 1, 0),
                          // The block content ends in the line before the one with closing bracket.
                          new Position(
                              blockEndPosition.line - 1,
                              docHelper.getLineByIndex(
                                  blockEndPosition.line - 1,
                              ).length,
                          ),
                      ),
                      blockType,
                      !(getBlocksWithoutVariableSupport() as string[]).includes(
                          blockName,
                      ),
                  )
                : undefined;

            if (!blockContent) {
                const remainingDocumentRange = docHelper.getTextRange(
                    new Position(lineIndex, 0),
                );

                result.textOutsideOfBlocks.push({
                    range: remainingDocumentRange,
                    text: docHelper.getText(remainingDocumentRange),
                });
                return result;
            }

            const { contentRange, content, variableRerences } = blockContent;

            result.blocks.push({
                name: blockName,
                nameRange: new Range(
                    new Position(lineIndex, line.indexOf(blockName)),
                    new Position(
                        lineIndex,
                        line.indexOf(blockName) + blockName.length,
                    ),
                ),
                content: content as
                    | string
                    | DictionaryBlockSimpleField[]
                    | ArrayBlockField[],
                contentRange,
                variableReferences: variableRerences,
            });

            // Skip the rest of the already parsed block
            currentTextOutsideOfBlocksStart = new Position(
                contentRange.end.line,
                contentRange.end.character + 1,
            );
            lineIndex = contentRange.end.line + 1;
        } else {
            if (currentTextOutsideOfBlocksStart == undefined) {
                currentTextOutsideOfBlocksStart = new Position(lineIndex, 0);
            }

            if (lineIndex == docHelper.getLineCount() - 1) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStart,
                        new Position(
                            lineIndex,
                            docHelper.getLineByIndex(lineIndex).length,
                        ),
                        docHelper,
                    ),
                );
            }

            lineIndex++;
        }
    }

    return result;
};

const getCurrentTextOutsideOfBlocks = (
    startPosition: Position,
    lastPosition: Position,
    document: TextDocumentHelper,
): TextOutsideOfBlocks => {
    const range = new Range(startPosition, lastPosition);

    return {
        text: document.getText(range),
        range,
    };
};
