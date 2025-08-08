import { lstat, readFile } from "fs";
import {
    checkIfPathExistsAsync,
    getExtensionForBrunoFiles,
    getSequenceFieldFromMetaBlock,
    TextDocumentHelper,
} from "../../..";
import { extname } from "path";
import { promisify } from "util";

export async function parseSequenceFromMetaBlock(filePath: string) {
    if (
        !(await checkIfPathExistsAsync(filePath)) ||
        !(await promisify(lstat)(filePath)).isFile() ||
        extname(filePath) != getExtensionForBrunoFiles()
    ) {
        return undefined;
    }

    const sequence = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(await promisify(readFile)(filePath, "utf-8"))
    );

    return sequence && !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
}
