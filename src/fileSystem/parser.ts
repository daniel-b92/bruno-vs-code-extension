import { readFileSync } from "fs";

export const getSequence = (testFilePath: string) => {
    try {
        const fileContent = readFileSync(testFilePath).toString();
        const metaSectionContent = fileContent
            .replace(/\s*meta\s*{\s*(\r\n|\n)/, "")
            .match(/[^}]*}/)?.[0]
            .replace(/}.*/, "")!;
        const sequence = metaSectionContent
            .match(/\s*seq:\s*\d*\s*(\r\n|\n)/)?.[0]
            .replace(/\s*seq:\s*/, "")
            .trimEnd();
        return sequence ? Number.parseInt(sequence): undefined;
    } catch (err) {
        console.log(`Could not determine sequence for test file '${testFilePath}'`)
        return undefined;
    }
};
