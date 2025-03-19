import { existsSync, lstatSync, readFileSync } from "fs";
import { EndOfLine, Position, Range, TextDocument } from "vscode";
import { RequestFileBlockName } from "./requestFileBlockNameEnum";
import { RequestFileBlock } from "./interfaces";

export const getSequence = (testFilePath: string) => {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }
    const metaSectionContent = getMetaBlockContent(testFilePath);
    const sequence = metaSectionContent
        ? getSequenceFromMetaBlockContent(testFilePath, metaSectionContent)
        : undefined;

    return sequence && !isNaN(Number(sequence)) ? Number(sequence) : undefined;
};

export const parseTestFile = (document: TextDocument) => {
    const getSectionContent = (sectionStartPosition: Position) => {
        const lines: string[] = [];
        let openCurlyBrackets = 1;
        // the section content is exclusive of the section's opening curly bracket line
        let lineIndex = sectionStartPosition.line + 1;

        while (openCurlyBrackets > 0 && lineIndex < document.lineCount) {
            const lineText = document.lineAt(lineIndex).text;
            const openingBracketsMatches = lineText.match(/{/);
            const closingBracketsMatches = lineText.match(/}/);

            openCurlyBrackets =
                openCurlyBrackets +
                (openingBracketsMatches ? openingBracketsMatches.length : 0) -
                (closingBracketsMatches ? closingBracketsMatches.length : 0);

            // the section content is exclusive of the section's closing curly bracket line
            if (openCurlyBrackets > 0) {
                lines.push(lineText);
            }
            lineIndex++;
        }

        return {
            content: lines.join(document.eol == EndOfLine.LF ? "\n" : "\r\n"),
            range: new Range(
                sectionStartPosition,
                new Position(
                    lineIndex - 1,
                    document.lineAt(lineIndex - 1).text.lastIndexOf("}")
                )
            ),
        };
    };

    const sectionStartPattern = /^\s*(\S+)\s*{\s*$/;
    const result: RequestFileBlock[] = [];

    let currentSection: { type: string; startPosition: Position } | undefined;
    let i = 0;

    while (i < document.lineCount) {
        const line = document.lineAt(i);
        const matches = sectionStartPattern.exec(line.text);

        if (matches && matches.length > 0) {
            currentSection = {
                type: matches[1],
                startPosition: new Position(i, matches.index),
            };

            const { content, range } = getSectionContent(
                currentSection.startPosition
            );

            result.push({
                type: currentSection.type,
                range,
                content,
            });

            i = range.end.line + 1;
        } else {
            i++;
        }
    }

    return result;
};

const getMetaBlockContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const startPattern = getSectionStartPattern(RequestFileBlockName.Meta);

    const maybeMatches = fileContent.match(startPattern)
        ? fileContent.replace(startPattern, "").match(/[^}]*}/)
        : undefined;
    return maybeMatches ? maybeMatches[0].replace(/}.*/, "") : undefined;
};

const getSequenceFromMetaBlockContent = (
    testFilePath: string,
    metaSectionContent: string
) => {
    const maybeMatches = metaSectionContent.match(/\s*seq:\s*\d*\s*(\r\n|\n)/);
    if (maybeMatches == null) {
        console.warn(
            `Could not determine sequence for test file '${testFilePath}'`
        );
        return undefined;
    }
    return maybeMatches[0].replace(/\s*seq:\s*/, "").trimEnd();
};

const getSectionStartPattern = (sectionName: RequestFileBlockName) =>
    new RegExp(`\\s*${sectionName}\\s*{\\s*(\\r\\n|\\n)`);
