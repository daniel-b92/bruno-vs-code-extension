import { existsSync, lstatSync, readFileSync } from "fs";
import { Position, TextDocument } from "vscode";
import { RequestFileBlockName } from "./requestFileBlockNameEnum";
import { RequestFileBlock } from "./interfaces";
import { getBlockContent } from "./blockParsing/getBlockContent";

export const getSequence = (testFilePath: string) => {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }
    const metaBlockContent = getMetaBlockContent(testFilePath);
    const sequence = metaBlockContent
        ? getSequenceFromMetaBlockContent(testFilePath, metaBlockContent)
        : undefined;

    return sequence && !isNaN(Number(sequence)) ? Number(sequence) : undefined;
};

export const parseTestFile = (document: TextDocument) => {
    const blockStartPattern = /^\s*(\S+)\s*{\s*$/;
    const result: RequestFileBlock[] = [];

    let lineIndex = 0;

    while (lineIndex < document.lineCount) {
        const line = document.lineAt(lineIndex);
        const matches = blockStartPattern.exec(line.text);

        if (matches && matches.length > 0) {
            const blockName = matches[1];
            const startingBracket = new Position(
                lineIndex,
                matches[0].length + matches.index
            );

            const { range, content } = getBlockContent(
                document,
                startingBracket,
                blockName
            );

            result.push({
                name: blockName,
                range,
                content,
            });

            // Skip the rest of the already parsed block
            lineIndex = range.end.line + 1;
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
