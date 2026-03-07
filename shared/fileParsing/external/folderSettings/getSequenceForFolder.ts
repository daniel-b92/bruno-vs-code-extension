import { lstat } from "fs";
import { parseSequenceFromMetaBlock } from "../shared/parseSequenceFromMetaBlock";
import {
    checkIfPathExistsAsync,
    getFolderSettingsFilePath,
    normalizeDirectoryPath,
} from "../../..";
import { promisify } from "util";

export async function getSequenceForFolder(
    collectionRootDirectory: string,
    folderPath: string,
) {
    if (
        !(await checkIfPathExistsAsync(folderPath)) ||
        !(await promisify(lstat)(folderPath)
            .then((stats) => stats.isDirectory())
            .catch(() => undefined)) ||
        normalizeDirectoryPath(collectionRootDirectory) ==
            normalizeDirectoryPath(folderPath)
    ) {
        return undefined;
    }

    const folderSettingsFile = await getFolderSettingsFilePath(
        false,
        folderPath,
    );

    return folderSettingsFile
        ? await parseSequenceFromMetaBlock(folderSettingsFile)
        : undefined;
}
