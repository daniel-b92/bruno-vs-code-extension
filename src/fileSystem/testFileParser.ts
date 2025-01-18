import { readFileSync } from "fs";

export const getSequence = (testFilePath: string) => {
    const metaSectionContent = getMetaSectionContent(testFilePath);

    try {
        const sequence = metaSectionContent
            ? metaSectionContent
                  .match(/\s*seq:\s*\d*\s*(\r\n|\n)/)?.[0]
                  .replace(/\s*seq:\s*/, "")
                  .trimEnd()
            : undefined;
        return sequence ? Number.parseInt(sequence) : undefined;
    } catch (err) {
        console.log(
            `Could not determine sequence for test file '${testFilePath}'`
        );
        return undefined;
    }
};

export const getName = (testFilePath: string) => {
    const metaSectionContent = getMetaSectionContent(testFilePath);

    return metaSectionContent
        ? metaSectionContent
              .match(/\s*name:\s*\d*\s*(\r\n|\n)/)?.[0]
              .replace(/\s*name:\s*/, "")
              .trimEnd()
        : undefined;
};

const getMetaSectionContent = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    return fileContent
        .replace(/\s*meta\s*{\s*(\r\n|\n)/, "")
        .match(/[^}]*}/)?.[0];
};
