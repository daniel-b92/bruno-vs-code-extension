import { readFile, writeFile } from "fs/promises";
import {
    CollectionFormat,
    getSequenceValueRangeFromFileContent,
} from "@global_shared";
import { addSequenceToSection } from "../sequenceUtils/addSequenceToSection";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

/**
 * Sets the sequence of a request or app file. If the file has no sequence yet, it is added.
 *
 * @returns Whether the sequence could be set.
 */
export async function setSequenceForRequestOrAppFile(
    filePath: string,
    sequence: number,
    format: CollectionFormat,
) {
    const content = await readFile(filePath, "utf-8").catch(() => undefined);

    if (content === undefined) {
        return false;
    }

    if (getSequenceValueRangeFromFileContent(filePath, content)) {
        return await replaceSequenceForFile(filePath, sequence);
    }

    const { contentWithSequence } = addSequenceToSection(
        content,
        sequence,
        format,
    );

    return contentWithSequence === undefined
        ? false
        : await writeFile(filePath, contentWithSequence)
              .then(() => true)
              .catch(() => false);
}
