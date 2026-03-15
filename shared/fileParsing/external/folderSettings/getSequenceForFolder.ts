import { lstat } from "fs";
import { parseSequenceFromMetaBlock } from "../shared/parseSequenceFromMetaBlock";
import {
    checkIfPathExistsAsync,
    getFolderSettingsFilePath,
    normalizePath,
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
        normalizePath(collectionRootDirectory) == normalizePath(folderPath)
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
