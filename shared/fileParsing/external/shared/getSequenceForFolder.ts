import { lstat } from "fs";
import {
    checkIfPathExistsAsync,
    CollectionFormat,
    getFolderSettingsFilePath,
    normalizePath,
    parseSequenceFromFile,
} from "../../..";
import { promisify } from "util";

export async function getSequenceForFolder(
    collectionRootDirectory: string,
    folderPath: string,
    format = CollectionFormat.Bru,
) {
    if (
        !(await checkIfPathExistsAsync(folderPath)) ||
        !(await promisify(lstat)(folderPath)
            .then((stats) => stats.isDirectory())
            .catch(() => undefined)) ||
        normalizePath(collectionRootDirectory) == normalizePath(folderPath)
    ) {
        return undefined;
    }

    const folderSettingsFile = await getFolderSettingsFilePath(
        false,
        folderPath,
        format,
    );

    return folderSettingsFile
        ? await parseSequenceFromFile(folderSettingsFile)
        : undefined;
}
