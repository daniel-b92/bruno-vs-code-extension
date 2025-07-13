import { lstat, readdir } from "fs";
import {
    CollectionItemProvider,
    getFolderSettingsFilePath,
    getSequenceForFolder,
} from "../../..";
import { resolve } from "path";
import { promisify } from "util";

export async function getSequencesForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
): Promise<{ folderPath: string; settingsFile: string; sequence: number }[]> {
    const collection = itemProvider.getAncestorCollectionForPath(parentFolder);

    if (!collection || !collection.getStoredDataForPath(parentFolder)) {
        return [];
    }

    const allChildItems = (await promisify(readdir)(parentFolder)).map(
        (itemName) => resolve(parentFolder, itemName)
    );

    const mappedArray = await Promise.all(
        allChildItems.map(async (item) =>
            (await promisify(lstat)(item)).isDirectory()
        )
    );

    const onlyDirectories = allChildItems.filter(
        (_item, index) => mappedArray[index]
    );

    const mappedDirectories = await Promise.all(
        onlyDirectories.map(async (folderPath) => {
            return {
                folderPath,
                settingsFile: await getFolderSettingsFilePath(folderPath),
                sequence: await getSequenceForFolder(
                    collection.getRootDirectory(),
                    folderPath
                ),
            };
        })
    );

    return mappedDirectories.filter(
        ({ sequence }) => sequence != undefined
    ) as {
        folderPath: string;
        settingsFile: string;
        sequence: number;
    }[];
}
