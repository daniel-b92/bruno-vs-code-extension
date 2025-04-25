import { existsSync, lstatSync, readFileSync } from "fs";
import { Position, Range } from "vscode";
import { RequestFileBlockName } from "../languageUtils/requestFileBlockNameEnum";
import {
    RequestFileBlock,
    TextOutsideOfBlocks,
} from "./external/interfaces";
import { getBlockContent } from "./internal/getBlockContent";
import { TextDocumentHelper } from "../fileSystem/util/textDocumentHelper";
import { parseBlockFromTestFile } from "./external/parseBlockFromTestFile";

export const getSequence = (testFilePath: string) => {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }
    const sequenceKeyName = "seq";

    const metaBlockContent = parseBlockFromTestFile(
        new TextDocumentHelper(readFileSync(testFilePath).toString()),
        RequestFileBlockName.Meta
    );

    const sequence =
        metaBlockContent && Array.isArray(metaBlockContent)
            ? metaBlockContent.find(({ key }) => key == sequenceKeyName)
            : undefined;

    return sequence && !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
};

export const parseTestFile = (document: TextDocumentHelper) => {
    const blockStartPattern = /^\s*(\S+)\s*{\s*$/m;
    const result: {
        blocks: RequestFileBlock[];
        textOutsideOfBlocks: TextOutsideOfBlocks[];
    } = { blocks: [], textOutsideOfBlocks: [] };

    let lineIndex = 0;
    let currentTextOutsideOfBlocksStart: Position | undefined;

    while (lineIndex < document.getLineCount()) {
        const line = document.getLineByIndex(lineIndex);
        const matches = blockStartPattern.exec(line);

        if (matches && matches.length > 0) {
            if (currentTextOutsideOfBlocksStart != undefined) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStart,
                        new Position(lineIndex, matches.index),
                        document
                    )
                );

                currentTextOutsideOfBlocksStart = undefined;
            }

            const blockName = matches[1];
            const startingBracket = new Position(
                lineIndex,
                matches[0].length + matches.index
            );

            const { contentRange, content } = getBlockContent(
                document,
                startingBracket
            );

            result.blocks.push({
                name: blockName,
                nameRange: new Range(
                    new Position(lineIndex, line.indexOf(blockName)),
                    new Position(
                        lineIndex,
                        line.indexOf(blockName) + blockName.length
                    )
                ),
                content,
                contentRange,
            });

            // Skip the rest of the already parsed block
            currentTextOutsideOfBlocksStart = new Position(
                contentRange.end.line,
                contentRange.end.character + 1
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
                            document.getLineByIndex(lineIndex).length
                        ),
                        document
                    )
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
    document: TextDocumentHelper
): TextOutsideOfBlocks => {
    const range = new Range(startPosition, lastPosition);

    return {
        text: document.getText(range),
        range,
    };
};
