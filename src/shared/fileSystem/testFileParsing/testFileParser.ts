import { existsSync, lstatSync, readFileSync } from "fs";
import { Position, Range, TextDocument } from "vscode";
import { RequestFileBlockName } from "./requestFileBlockNameEnum";
import { RequestFileBlock } from "./interfaces";

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
    const getBlockContent = (startingBracket: Position) => {
        const lines: string[] = [];
        let openCurlyBrackets = 1;
        // the block content is exclusive of the block's opening curly bracket line
        const firstLine = startingBracket.line + 1;
        let lineIndex = firstLine;

        while (openCurlyBrackets > 0 && lineIndex < document.lineCount) {
            const lineText = document.lineAt(lineIndex).text;
            const openingBracketsMatches = lineText.match(/{/);
            const closingBracketsMatches = lineText.match(/}/);

            openCurlyBrackets =
                openCurlyBrackets +
                (openingBracketsMatches ? openingBracketsMatches.length : 0) -
                (closingBracketsMatches ? closingBracketsMatches.length : 0);

            // the block content is exclusive of the block's closing curly bracket line
            if (openCurlyBrackets > 0) {
                lines.push(lineText);
                lineIndex++;
            }
        }

        const range = new Range(
            new Position(firstLine, 0),
            new Position(
                lineIndex,
                document.lineAt(lineIndex).text.lastIndexOf("}")
            )
        );

        return {
            content: document.getText(range),
            range,
        };
    };

    const blockStartPattern = /^\s*(\S+)\s*{\s*$/;
    const result: RequestFileBlock[] = [];

    let currentBlock: { type: string; startingBracket: Position } | undefined;
    let lineIndex = 0;

    while (lineIndex < document.lineCount) {
        const line = document.lineAt(lineIndex);
        const matches = blockStartPattern.exec(line.text);

        if (matches && matches.length > 0) {
            currentBlock = {
                type: matches[1],
                startingBracket: new Position(lineIndex, matches.index),
            };

            const { content, range } = getBlockContent(
                currentBlock.startingBracket
            );

            result.push({
                type: currentBlock.type,
                range,
                content,
            });

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
