import { lstat } from "fs";
import { parseSequenceFromMetaBlock } from "../shared/parseSequenceFromMetaBlock";
import {
    checkIfFileExistsAsync,
    getFolderSettingsFilePath,
    normalizeDirectoryPath,
} from "../../..";
import { promisify } from "util";

export async function getSequenceForFolder(
    collectionRootDirectory: string,
    folderPath: string
) {
    if (
        !(await checkIfFileExistsAsync(folderPath)) ||
        !(await promisify(lstat)(folderPath)).isDirectory() ||
        normalizeDirectoryPath(collectionRootDirectory) ==
            normalizeDirectoryPath(folderPath)
    ) {
        return undefined;
    }

    const folderSettingsFile = await getFolderSettingsFilePath(folderPath);

    return folderSettingsFile
        ? await parseSequenceFromMetaBlock(folderSettingsFile)
        : undefined;
}
