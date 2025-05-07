import { existsSync, lstatSync, readFileSync } from "fs";
import { getSequenceFieldFromMetaBlock, TextDocumentHelper } from "../../..";

export function getSequenceFromMetaBlock(testFilePath: string) {
    if (!existsSync(testFilePath) || !lstatSync(testFilePath).isFile()) {
        return undefined;
    }

    const sequence = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(readFileSync(testFilePath).toString())
    );

    return sequence && !isNaN(Number(sequence.value))
        ? Number(sequence.value)
        : undefined;
}
