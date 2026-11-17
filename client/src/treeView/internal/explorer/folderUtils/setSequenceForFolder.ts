import { basename, resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import {
    CollectionFormat,
    getFolderSettingsFilePath,
    getFolderSettingsFileName,
    getSequenceValueRangeFromFileContent,
} from "@global_shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";

/**
 * Sets the sequence in the folder settings file of the given folder, without changing any other settings.
 *
 * - If the folder has no settings file yet, a minimal one is created.
 * - If the settings file has no sequence yet, it is added.
 *
 * @returns Whether the sequence could be set.
 */
export async function setSequenceForFolder(
    folderPath: string,
    sequence: number,
    format: CollectionFormat,
) {
    const folderName = basename(folderPath);
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

    const content = await readFile(settingsFile, "utf-8").catch(
        () => undefined,
    );

    if (content === undefined) {
        return false;
    }

    if (getSequenceValueRangeFromFileContent(settingsFile, content)) {
        await replaceSequenceForFile(settingsFile, sequence);
        return true;
    }

    const contentWithSequence = addSequenceToContent(
        content,
        folderName,
        sequence,
        format,
    );

    return contentWithSequence === undefined
        ? false
        : await writeFile(settingsFile, contentWithSequence)
              .then(() => true)
              .catch(() => false);
}

function getMinimalContent(
    folderName: string,
    sequence: number,
    format: CollectionFormat,
) {
    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${folderName}\n  type: folder\n  seq: ${sequence}\n`
        : `meta {\n  name: ${folderName}\n  seq: ${sequence}\n}\n`;
}

/** Returns `undefined` if the existing content has a structure that is not supported for adding the sequence. */
function addSequenceToContent(
    content: string,
    folderName: string,
    sequence: number,
    format: CollectionFormat,
) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const [sectionAnywhere, sectionStart] =
        format == CollectionFormat.Yaml
            ? ([/^info:/m, /^info:[ \t]*\r?\n/m] as const)
            : ([/^meta[ \t]*\{/m, /^meta[ \t]*\{[ \t]*\r?\n/m] as const);
    const match = sectionStart.exec(content);

    if (!match && sectionAnywhere.test(content)) {
        // The section exists, but not in the usual multi-line notation (e.g. `info: {}`).
        return undefined;
    }

    if (!match) {
        // A file that has no `info` or `meta` section at all (e.g. one with only headers).
        const separator = content.length > 0 ? eol : "";
        return (
            getMinimalContent(folderName, sequence, format).replace(
                /\n/g,
                eol,
            ) +
            separator +
            content
        );
    }

    const insertionIndex = match.index + match[0].length;
    // The new line needs to use the same indentation as the existing properties of the section.
    const indentation =
        /^([ \t]+)\S/.exec(content.slice(insertionIndex))?.[1] ?? "  ";

    return (
        content.slice(0, insertionIndex) +
        `${indentation}seq: ${sequence}${eol}` +
        content.slice(insertionIndex)
    );
}
