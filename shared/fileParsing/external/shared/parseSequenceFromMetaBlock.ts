import { lstat, readFile } from "fs";
import {
    checkIfPathExistsAsync,
    getExtensionForBrunoFiles,
    getSequenceFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
} from "../../..";
import { extname } from "path";
import { promisify } from "util";

export async function parseSequenceFromMetaBlock(filePath: string) {
    if (
        !(await checkIfPathExistsAsync(filePath)) ||
        !(await promisify(lstat)(filePath)
            .then((stats) => stats.isFile())
            .catch(() => undefined)) ||
        extname(filePath) != getExtensionForBrunoFiles()
    ) {
        return undefined;
    }

    const content = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    const sequence = content
        ? getSequenceFieldFromMetaBlock(new TextDocumentHelper(content))
        : undefined;

    return sequence &&
        isDictionaryBlockSimpleField(sequence) &&
        !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
}
