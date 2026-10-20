import { BrunoFileType, ItemType } from "@global_shared";
import { isYamlAppFile } from "./isYamlAppFile";

/** The cache only reflects the file content on disk, so the current editor content is used to tell app files and request files apart. */
export function getYamlFileTypeForEditorContent<T extends ItemType>(
    fileType: T,
    text: string,
): T | BrunoFileType.AppFile | BrunoFileType.RequestFile {
    return fileType == BrunoFileType.RequestFile ||
        fileType == BrunoFileType.AppFile
        ? isYamlAppFile(text)
            ? BrunoFileType.AppFile
            : BrunoFileType.RequestFile
        : fileType;
}
