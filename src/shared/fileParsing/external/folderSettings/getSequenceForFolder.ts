import { existsSync, lstatSync } from "fs";
import { parseSequenceFromMetaBlock } from "../shared/parseSequenceFromMetaBlock";
import { getFolderSettingsFilePath, normalizeDirectoryPath } from "../../..";

export function getSequenceForFolder(
    collectionRootDirectory: string,
    folderPath: string
) {
    if (
        !existsSync(folderPath) ||
        !lstatSync(folderPath).isDirectory() ||
        normalizeDirectoryPath(collectionRootDirectory) ==
            normalizeDirectoryPath(folderPath)
    ) {
        return undefined;
    }

    const folderSettingsFile = getFolderSettingsFilePath(folderPath);

    return folderSettingsFile
        ? parseSequenceFromMetaBlock(folderSettingsFile)
        : undefined;
}
