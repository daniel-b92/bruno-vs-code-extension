import { existsSync, lstatSync, readdirSync } from "fs";
import { getSequenceFromMetaBlock } from "../shared/getSequenceFromMetaBlock";
import { resolve } from "path";
import {
    doesFileNameMatchFolderSettingsFileName,
    normalizeDirectoryPath,
} from "../../..";

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

    const settingsFileName = readdirSync(folderPath).find(
        doesFileNameMatchFolderSettingsFileName
    );

    if (!settingsFileName) {
        return undefined;
    }

    return getSequenceFromMetaBlock(resolve(folderPath, settingsFileName));
}
