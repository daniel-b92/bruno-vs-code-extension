import { existsSync, lstatSync, readFileSync } from "fs";

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

const getMetaSectionContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const startPattern = /\s*meta\s*{\s*(\r\n|\n)/;

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
