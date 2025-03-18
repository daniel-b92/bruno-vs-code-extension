import { existsSync, lstatSync, readFileSync } from "fs";
import { TextDocument } from "vscode";
import { RequestFileSection } from "../../requestFileSectionsEnum";

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

export const hasSection = (
    document: TextDocument,
    section: RequestFileSection
) => document.getText().match(getSectionStartPattern(section)) != null;

const getMetaSectionContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const startPattern = getSectionStartPattern(RequestFileSection.Meta);

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

const getSectionStartPattern = (sectionName: RequestFileSection) =>
    new RegExp(`\\s*${sectionName}\\s*{\\s*(\\r\\n|\\n)`);
