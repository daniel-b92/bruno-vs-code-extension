import { basename, resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { stringify } from "yaml";
import {
    CollectionFormat,
    getFolderSettingsFilePath,
    getFolderSettingsFileName,
    getSequenceValueRangeFromFileContent,
    removeSequencePrefix,
} from "@global_shared";
import { shouldPrefixNamesWithSequence } from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";

/**
 * Sets the sequence in the folder settings file of the given folder, without changing any other settings.
 *
 * - If the folder has no settings file yet, a minimal one is created.
 * - If the settings file has no sequence yet, it is added.
 * - If a name has to be stored as well, it does not contain the sequence prefix of the folder (if names are prefixed with sequences).
 *
 * @returns Whether the sequence could be set.
 */
export async function setSequenceForFolder(
    folderPath: string,
    sequence: number,
    format: CollectionFormat,
) {
    const folderName = shouldPrefixNamesWithSequence()
        ? removeSequencePrefix(basename(folderPath), { sequence })
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

    const content = await readFile(settingsFile, "utf-8").catch(
        () => undefined,
    );

    if (content === undefined) {
        return false;
    }

    if (getSequenceValueRangeFromFileContent(settingsFile, content)) {
        return await replaceSequenceForFile(settingsFile, sequence);
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
    // Quotes the name if needed, so that it is read back as the same string (e.g. for names containing `: ` or ` #`, or names like `123`).
    const yamlName = stringify(folderName, { lineWidth: 0 }).trimEnd();

    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${yamlName}\n  type: folder\n  seq: ${sequence}\n`
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

    if (hasSequenceKey(content.slice(insertionIndex))) {
        // There is a `seq` key, but its value is not a valid sequence. Adding a second one would make the file invalid.
        return undefined;
    }

    // The new line needs to use the same indentation as the existing properties of the section.
    const indentation =
        /^([ \t]+)\S/.exec(content.slice(insertionIndex))?.[1] ?? "  ";

    return (
        content.slice(0, insertionIndex) +
        `${indentation}seq: ${sequence}${eol}` +
        content.slice(insertionIndex)
    );
}

/** Checks whether the section that starts at the beginning of the given content (up to the next non-indented line) contains a `seq` key. */
function hasSequenceKey(contentAfterSectionStart: string) {
    for (const line of contentAfterSectionStart.split(/\r?\n/)) {
        if (/^\S/.test(line)) {
            return false;
        }

        if (/^[ \t]+seq[ \t]*:/.test(line)) {
            return true;
        }
    }

    return false;
}
