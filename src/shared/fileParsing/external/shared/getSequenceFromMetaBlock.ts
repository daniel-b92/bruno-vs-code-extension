import { existsSync, lstatSync, readFileSync } from "fs";
import {
    getExtensionForRequestFiles,
    getSequenceFieldFromMetaBlock,
    TextDocumentHelper,
} from "../../..";
import { extname } from "path";

export function getSequenceFromMetaBlock(testFilePath: string) {
    if (
        !existsSync(testFilePath) ||
        !lstatSync(testFilePath).isFile() ||
        extname(testFilePath) != getExtensionForRequestFiles()
    ) {
        return undefined;
    }

    const sequence = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(readFileSync(testFilePath).toString())
    );

    return sequence && !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
}
