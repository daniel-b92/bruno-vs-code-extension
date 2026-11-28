import { basename, resolve } from "path";
import { writeFile } from "fs/promises";
import { stringify } from "yaml";
import {
    CollectionFormat,
    getFolderSettingsFilePath,
    getFolderSettingsFileName,
    removeSequencePrefix,
} from "@global_shared";
import { shouldPrefixNamesWithSequence } from "@shared";
import { setSequenceInFile } from "../sequenceUtils/setSequenceInFile";

/**
 * Sets the sequence in the folder settings file of the given folder, without changing any other settings.
 *
 * - If the folder has no settings file yet, a minimal one is created.
 * - If the settings file has no sequence yet, it is added.
 * - If a name has to be stored as well, it is the name of the folder. If names are prefixed with sequences, a prefix matching the new sequence is not stored.
 *   Other leading digits are kept, even if they are padded with zeros (e.g. `007_bond`), since a folder without a stored name was named by the user.
 *
 * @returns Whether the sequence could be set.
 */
export async function setSequenceForFolder(
    folderPath: string,
    sequence: number,
    format: CollectionFormat,
) {
    const folderName = shouldPrefixNamesWithSequence()
        ? removeSequencePrefix(basename(folderPath), {
              sequence,
              // Without a stored name, padded digits would be treated as a prefix as well.
              storedName: basename(folderPath),
          })
        : basename(folderPath);
    const settingsFile = await getFolderSettingsFilePath(
        false,
        folderPath,
        format,
    );

    if (!settingsFile) {
        return await writeFile(
            resolve(folderPath, getFolderSettingsFileName(format)),
            getMinimalContent(folderName, sequence, format),
        )
            .then(() => true)
            .catch(() => false);
    }

    return await setSequenceInFile(settingsFile, sequence, format, (content) =>
        addSectionToContent(content, folderName, sequence, format),
    );
}

function getMinimalContent(
    folderName: string,
    sequence: number,
    format: CollectionFormat,
) {
    // Quotes the name if needed, so that it is read back as the same string (e.g. for names containing `: ` or ` #`, or names like `123`).
    const yamlName = stringify(folderName, { lineWidth: 0 }).trimEnd();

    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${yamlName}\n  type: folder\n  seq: ${sequence}\n`
        : `meta {\n  name: ${folderName}\n  seq: ${sequence}\n}\n`;
}

/** For a file that has no `info` or `meta` section at all (e.g. one with only headers). */
function addSectionToContent(
    content: string,
    folderName: string,
    sequence: number,
    format: CollectionFormat,
) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const separator = content.length > 0 ? eol : "";

    return (
        getMinimalContent(folderName, sequence, format).replace(/\n/g, eol) +
        separator +
        content
    );
}
