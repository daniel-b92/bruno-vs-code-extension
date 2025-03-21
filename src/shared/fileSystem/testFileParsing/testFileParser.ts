import { existsSync, lstatSync, readFileSync } from "fs";
import { Position, Range } from "vscode";
import { RequestFileBlockName } from "./definitions/requestFileBlockNameEnum";
import { RequestFileBlock } from "./definitions/interfaces";
import { getBlockContent } from "./blockParsing/getBlockContent";
import { TextDocumentHelper } from "../util/textDocumentHelper";

export const getSequence = (testFilePath: string) => {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }
    // ToDo: Unify with parser for parsing entire testfile
    const metaBlockContent = getMetaBlockContent(testFilePath);
    const sequence = metaBlockContent
        ? getSequenceFromMetaBlockContent(testFilePath, metaBlockContent)
        : undefined;

    return sequence && !isNaN(Number(sequence)) ? Number(sequence) : undefined;
};

export const parseTestFile = (document: TextDocumentHelper) => {
    const blockStartPattern = /^\s*(\S+)\s*{\s*$/;
    const result: RequestFileBlock[] = [];

    let lineIndex = 0;

    while (lineIndex < document.getLineCount()) {
        const line = document.getLineByIndex(lineIndex);
        const matches = blockStartPattern.exec(line);

        if (matches && matches.length > 0) {
            const blockName = matches[1];
            const startingBracket = new Position(
                lineIndex,
                matches[0].length + matches.index
            );

            const { contentRange, content } = getBlockContent(
                document,
                startingBracket
            );

            result.push({
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
            lineIndex++;
        }
    }

    return result;
};

const getMetaBlockContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const startPattern = getBlockStartPattern(RequestFileBlockName.Meta);

    const maybeMatches = fileContent.match(startPattern)
        ? fileContent.replace(startPattern, "").match(/[^}]*}/)
        : undefined;
    return maybeMatches ? maybeMatches[0].replace(/}.*/, "") : undefined;
};

const getSequenceFromMetaBlockContent = (
    testFilePath: string,
    metaBlockContent: string
) => {
    const maybeMatches = metaBlockContent.match(/\s*seq:\s*\d*\s*(\r\n|\n)/);
    if (maybeMatches == null) {
        console.warn(
            `Could not determine sequence for test file '${testFilePath}'`
        );
        return undefined;
    }
    return maybeMatches[0].replace(/\s*seq:\s*/, "").trimEnd();
};

const getBlockStartPattern = (blockName: RequestFileBlockName) =>
    new RegExp(`\\s*${blockName}\\s*{\\s*(\\r\\n|\\n)`);
