import { readFileSync } from "fs";

export const getSequence = (testFilePath: string) => {
    const fileContent = readFileSync(testFilePath).toString();
    const metaSectionContent = fileContent.replace(/\s*meta\s*{\s*(\r\n|\n)/, "").match(/[^}]*}/)?.[0].replace(/}.*/, "")!;
    const sequence = metaSectionContent.match(/\s*seq:\s*\d*\s*(\r\n|\n)/)?.[0].replace(/\s*seq:\s*/, "").trimEnd();
    return Number.parseInt(sequence!);
}