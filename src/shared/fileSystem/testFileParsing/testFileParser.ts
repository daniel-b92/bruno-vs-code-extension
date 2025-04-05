import { existsSync, lstatSync, readFileSync } from "fs";
import { Position, Range } from "vscode";
import { RequestFileBlockName } from "./definitions/requestFileBlockNameEnum";
import {
    RequestFileBlock,
    TextOutsideOfBlocks,
} from "./definitions/interfaces";
import { getBlockContent } from "./internal/getBlockContent";
import { TextDocumentHelper } from "../util/textDocumentHelper";

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
            ? metaBlockContent.find(({ name }) => name == sequenceKeyName)
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
    let currentTextOutsideOfBlocksStartLine: number | undefined;

    while (lineIndex < document.getLineCount()) {
        const line = document.getLineByIndex(lineIndex);
        const matches = blockStartPattern.exec(line);

        if (matches && matches.length > 0) {
            if (currentTextOutsideOfBlocksStartLine != undefined) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStartLine,
                        new Position(lineIndex, matches.index),
                        document
                    )
                );

                currentTextOutsideOfBlocksStartLine = undefined;
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
            lineIndex = contentRange.end.line + 1;
        } else {
            if (currentTextOutsideOfBlocksStartLine == undefined) {
                currentTextOutsideOfBlocksStartLine = lineIndex;
            }

            if (lineIndex == document.getLineCount() - 1) {
                result.textOutsideOfBlocks.push(
                    getCurrentTextOutsideOfBlocks(
                        currentTextOutsideOfBlocksStartLine,
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

const parseBlockFromTestFile = (
    document: TextDocumentHelper,
    blockName: RequestFileBlockName
) => {
    const blockStartPattern = new RegExp(`^\\s*${blockName}\\s*{\\s*$`, "m");

    const maybeMatches = document.getText().match(blockStartPattern);

    if (!maybeMatches || maybeMatches.length != 1) {
        return undefined;
    }

    const subDocumentUntilBlockStart = new TextDocumentHelper(
        document
            .getText()
            .substring(
                0,
                (maybeMatches.index as number) +
                    maybeMatches[0].indexOf("{") +
                    1
            )
    );
    const lineIndex = subDocumentUntilBlockStart.getLineCount() - 1;

    const startingBracket = new Position(
        lineIndex,
        subDocumentUntilBlockStart.getLineByIndex(lineIndex).lastIndexOf("{")
    );

    return getBlockContent(document, startingBracket).content;
};

const getCurrentTextOutsideOfBlocks = (
    startLineIndex: number,
    lastPosition: Position,
    document: TextDocumentHelper
): TextOutsideOfBlocks => {
    const range = new Range(new Position(startLineIndex, 0), lastPosition);

    return {
        text: document.getText(range),
        range,
    };
};
