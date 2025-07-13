import { existsSync, lstatSync, readFileSync } from "fs";
import {
    getExtensionForRequestFiles,
    getSequenceFieldFromMetaBlock,
    TextDocumentHelper,
} from "../../..";
import { extname } from "path";

export function parseSequenceFromMetaBlock(filePath: string) {
    if (
        !existsSync(filePath) ||
        !lstatSync(filePath).isFile() ||
        extname(filePath) != getExtensionForRequestFiles()
    ) {
        return undefined;
    }

    const sequence = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(readFileSync(filePath).toString())
    );

    return sequence && !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
}
