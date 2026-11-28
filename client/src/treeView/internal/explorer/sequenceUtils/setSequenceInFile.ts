import { readFile, writeFile } from "fs/promises";
import {
    CollectionFormat,
    getSequenceValueRangeFromFileContent,
} from "@global_shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { addSequenceToSection } from "./addSequenceToSection";

/**
 * Sets the sequence of a request, app or folder settings file. If the file has no sequence yet, it is added.
 * No error message is shown, so that the caller can show one that describes the failed operation.
 *
 * @returns Whether the sequence could be set.
 */
export async function setSequenceInFile(
    filePath: string,
    sequence: number,
    format: CollectionFormat,
    /** Returns the new content for a file without an `info` or `meta` section. If not provided, such a file is not changed. */
    addMissingSection?: (content: string) => string,
) {
    const content = await readFile(filePath, "utf-8").catch(() => undefined);

    if (content === undefined) {
        return false;
    }

    if (getSequenceValueRangeFromFileContent(filePath, content)) {
        return await replaceSequenceForFile(filePath, sequence, false);
    }

    const { hasSection, contentWithSequence } = addSequenceToSection(
        content,
        sequence,
        format,
    );
    const newContent = hasSection
        ? contentWithSequence
        : addMissingSection?.(content);

    return newContent === undefined
        ? false
        : await writeFile(filePath, newContent)
              .then(() => true)
              .catch(() => false);
}
