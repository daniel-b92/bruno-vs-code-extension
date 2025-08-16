import {
    DictionaryBlockField,
    Block,
    TextOutsideOfBlocks,
    ArrayBlockField,
} from "./interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { getBlockContent } from "../internal/getBlockContent";
import { getNonBlockSpecificBlockStartPattern } from "../internal/util/getNonBlockSpecificBlockStartPattern";
import { getBlockType, Position, Range } from "../..";

export const parseBruFile = (document: TextDocumentHelper) => {
    const result: {
        blocks: Block[];
        textOutsideOfBlocks: TextOutsideOfBlocks[];
    } = { blocks: [], textOutsideOfBlocks: [] };

    let lineIndex = 0;
    let currentTextOutsideOfBlocksStart: Position | undefined;

    while (lineIndex < document.getLineCount()) {
        const line = document.getLineByIndex(lineIndex);
        const matches = getNonBlockSpecificBlockStartPattern().exec(line);

        if (matches && matches.length > 0) {
            if (currentTextOutsideOfBlocksStart != undefined) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStart,
                        new Position(lineIndex, matches.index),
                        document,
                    ),
                );

                currentTextOutsideOfBlocksStart = undefined;
            }

            const blockName = matches[1];
            const startingPosition = new Position(
                lineIndex,
                matches[0].length + matches.index,
            );

            const blockContent = getBlockContent(
                document,
                startingPosition,
                getBlockType(matches[0], blockName),
            );

            if (!blockContent) {
                const remainingDocumentRange = document.getTextRange(
                    new Position(lineIndex, 0),
                );

                result.textOutsideOfBlocks.push({
                    range: remainingDocumentRange,
                    text: document.getText(remainingDocumentRange),
                });
                return result;
            }

            const { contentRange, content } = blockContent;

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
                    | DictionaryBlockField[]
                    | ArrayBlockField[],
                contentRange,
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

            if (lineIndex == document.getLineCount() - 1) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStart,
                        new Position(
                            lineIndex,
                            document.getLineByIndex(lineIndex).length,
                        ),
                        document,
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
