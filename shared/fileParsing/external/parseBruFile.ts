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
    BlockType,
} from "../..";
import { findBlockEnd } from "../internal/findBlockEnd";

export function parseBruFile(docHelper: TextDocumentHelper) {
    const result: {
        blocks: Block[];
        textOutsideOfBlocks: TextOutsideOfBlocks[];
    } = { blocks: [], textOutsideOfBlocks: [] };

    let currentTextOutsideOfBlocksStart: Position | undefined;

    for (let lineIndex = 0; lineIndex < docHelper.getLineCount(); lineIndex++) {
        const line = docHelper.getLineByIndex(lineIndex);
        const matches = getNonBlockSpecificBlockStartPattern().exec(line);

        if (!matches || matches.length == 0) {
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

            continue;
        }

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

            const parsedBlock = tryToParseBlock(docHelper, {
                blockName,
                blockType,
                startingLineContent: line,
                startingLineIndex: lineIndex,
                endPosition: blockEndPosition,
            });

            if ("text" in parsedBlock) {
                // Block could not be parsed properly and is returned as `TextOutsideOfBlocks`.
                result.textOutsideOfBlocks.push(parsedBlock);
                return result;
            }

            result.blocks.push(parsedBlock);
            const { contentRange } = parsedBlock;
            // Skip the rest of the already parsed block.
            currentTextOutsideOfBlocksStart = new Position(
                contentRange.end.line,
                contentRange.end.character + 1,
            );
            lineIndex = contentRange.end.line;
        }
    }

    return result;
}

function tryToParseBlock(
    docHelper: TextDocumentHelper,
    blockData: {
        blockName: string;
        blockType: BlockType;
        startingLineContent: string;
        startingLineIndex: number;
        endPosition?: Position;
    },
): Block | TextOutsideOfBlocks {
    const {
        blockName,
        blockType,
        startingLineContent,
        startingLineIndex,
        endPosition,
    } = blockData;
    const blockContent =
        endPosition == undefined
            ? undefined
            : getBlockContent(
                  docHelper,
                  new Range(
                      // The block content starts in the line after the one with the block name.
                      new Position(startingLineIndex + 1, 0),
                      // The block content ends in the line before the one with closing bracket.
                      new Position(
                          endPosition.line - 1,
                          docHelper.getLineByIndex(endPosition.line - 1).length,
                      ),
                  ),
                  blockType,
                  !(getBlocksWithoutVariableSupport() as string[]).includes(
                      blockName,
                  ),
              );

    if (!blockContent) {
        const remainingDocumentRange = docHelper.getTextRange(
            new Position(startingLineIndex, 0),
        );

        return {
            range: remainingDocumentRange,
            text: docHelper.getText(remainingDocumentRange),
        };
    }

    const { contentRange, content, variableRerences } = blockContent;

    return {
        name: blockName,
        nameRange: new Range(
            new Position(
                startingLineIndex,
                startingLineContent.indexOf(blockName),
            ),
            new Position(
                startingLineIndex,
                startingLineContent.indexOf(blockName) + blockName.length,
            ),
        ),
        content: content as
            | string
            | DictionaryBlockSimpleField[]
            | ArrayBlockField[],
        contentRange,
        variableReferences: variableRerences,
    };
}

function getCurrentTextOutsideOfBlocks(
    startPosition: Position,
    lastPosition: Position,
    document: TextDocumentHelper,
): TextOutsideOfBlocks {
    const range = new Range(startPosition, lastPosition);

    return {
        text: document.getText(range),
        range,
    };
}
