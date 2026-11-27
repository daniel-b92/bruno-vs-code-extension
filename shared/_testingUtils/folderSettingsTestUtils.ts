import { readdir } from "fs/promises";
import { basename, dirname, join } from "path";
import { CollectionDirectory } from "../baseModel/collectionDirectory";
import { CollectionFormat } from "../baseModel/interfaces";
import { parseSequenceFromFile } from "../fileParsing/external/shared/parseSequenceFromFile";
import { getFileExtensionForFormat } from "../fileSystem/util/collectionFormatFileNames";

/** Builds the content of a minimal folder settings file. */
export function folderSettingsContent(
    format: CollectionFormat,
    name: string,
    sequence: number,
) {
    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${name}\n  type: folder\n  seq: ${sequence}\n`
        : `meta {\n  name: ${name}\n  seq: ${sequence}\n}\n`;
}

/** Creates the collection item of a folder that has a settings file with a sequence. No files are written. */
export function createFolderItem(
    folderPath: string,
    format: CollectionFormat,
    sequence: number,
) {
    return new CollectionDirectory(
        folderPath,
        join(folderPath, `folder${getFileExtensionForFormat(format)}`),
        sequence,
    );
}

/** Returns the sequences of all folders below the directory that have a settings file (keys are the relative folder paths). */
export async function getFolderSequences(
    directory: string,
    format: CollectionFormat,
) {
    const settingsFileName = `folder${getFileExtensionForFormat(format)}`;
    const sequences: Record<string, number | undefined> = {};

    for (const relativePath of await readdir(directory, { recursive: true })) {
        if (basename(relativePath) == settingsFileName) {
            sequences[dirname(relativePath)] = await parseSequenceFromFile(
                join(directory, relativePath),
            );
        }
    }

    return sequences;
}
