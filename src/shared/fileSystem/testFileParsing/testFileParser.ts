import { existsSync, lstatSync, readFileSync } from "fs";
import { EndOfLine, Position, Range, TextDocument } from "vscode";
import { RequestFileSectionName } from "./requestFileSectionNameEnum";
import { RequestFileSection } from "./interfaces";

export const getSequence = (testFilePath: string) => {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }
    const metaSectionContent = getMetaSectionContent(testFilePath);
    const sequence = metaSectionContent
        ? getSequenceFromMetaSectionContent(testFilePath, metaSectionContent)
        : undefined;

    return sequence && !isNaN(Number(sequence)) ? Number(sequence) : undefined;
};

export const parseTestFile = (document: TextDocument) => {
    const getSectionContent = (firstLineIndex: number) => {
        const result: string[] = [];
        let openCurlyBrackets = 1;
        let lineIndex = firstLineIndex;

        while (openCurlyBrackets > 0 && lineIndex < document.lineCount) {
            const lineText = document.lineAt(lineIndex).text;
            const openingBracketsMatches = lineText.match(/{/);
            const closingBracketsMatches = lineText.match(/}/);

            openCurlyBrackets =
                openCurlyBrackets +
                (openingBracketsMatches ? openingBracketsMatches.length : 0) -
                (closingBracketsMatches ? closingBracketsMatches.length : 0);

            if (openCurlyBrackets > 0) {
                result.push(lineText);
            }
            lineIndex++;
        }

        return {
            content: result,
            lastPositionForSection: new Position(
                lineIndex - 1,
                document.lineAt(lineIndex - 1).text.lastIndexOf("}") + 1
            ),
            remainingLinesStartIndex: lineIndex,
        };
    };

    const sectionStartPattern = /^\s*(\S+)\s*{\s*$/;
    const result: RequestFileSection[] = [];

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

            const {
                content: sectionContent,
                lastPositionForSection,
                remainingLinesStartIndex,
            } = getSectionContent(i + 1);

            result.push({
                type: currentSection.type,
                range: new Range(
                    currentSection.startPosition,
                    lastPositionForSection
                ),
                content: sectionContent.join(
                    document.eol == EndOfLine.LF ? "\n" : "\r\n"
                ),
            });

            i = remainingLinesStartIndex;
        } else {
            i++;
        }
    }

    return result;
};

const getMetaSectionContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const startPattern = getSectionStartPattern(RequestFileSectionName.Meta);

    const maybeMatches = fileContent.match(startPattern)
        ? fileContent.replace(startPattern, "").match(/[^}]*}/)
        : undefined;
    return maybeMatches ? maybeMatches[0].replace(/}.*/, "") : undefined;
};

const getSequenceFromMetaSectionContent = (
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

const getSectionStartPattern = (sectionName: RequestFileSectionName) =>
    new RegExp(`\\s*${sectionName}\\s*{\\s*(\\r\\n|\\n)`);
