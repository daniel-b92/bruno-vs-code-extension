import { lstatSync, readdirSync } from "fs";
import {
    CollectionItemProvider,
    getFolderSettingsFilePath,
    getSequenceForFolder,
} from "../../..";
import { resolve } from "path";

export function getSequencesForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
): { folderPath: string; settingsFile: string; sequence: number }[] {
    const collection = itemProvider.getAncestorCollectionForPath(parentFolder);

    if (!collection || !collection.getStoredDataForPath(parentFolder)) {
        return [];
    }

    return readdirSync(parentFolder)
        .map((itemName) => resolve(parentFolder, itemName))
        .filter((item) => lstatSync(item).isDirectory())
        .map((folderPath) => {
            return {
                folderPath,
                settingsFile: getFolderSettingsFilePath(folderPath),
                sequence: getSequenceForFolder(
                    collection.getRootDirectory(),
                    folderPath
                ),
            };
        })
        .filter(({ sequence }) => sequence != undefined) as {
        folderPath: string;
        settingsFile: string;
        sequence: number;
    }[];
}
