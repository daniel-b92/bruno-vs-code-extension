import { Document } from "yaml";
import { BrunoFileType, ItemType } from "@global_shared";
import { isYamlAppFile } from "./isYamlAppFile";

/** The cache only reflects the file content on disk, so the current editor content is used to tell app files and request files apart. */
export function getYamlFileTypeForEditorContent<T extends ItemType>(
    fileType: T,
    text: string,
    /** If defined, it is used instead of parsing the text again. It needs to be the parsed text. */
    parsedDocument?: Document,
): T | BrunoFileType.AppFile | BrunoFileType.RequestFile {
    return fileType == BrunoFileType.RequestFile ||
        fileType == BrunoFileType.AppFile
        ? isYamlAppFile(text, parsedDocument)
            ? BrunoFileType.AppFile
            : BrunoFileType.RequestFile
        : fileType;
}
