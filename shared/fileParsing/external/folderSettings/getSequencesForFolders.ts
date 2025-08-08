import { lstat, readdir } from "fs";
import {
    CollectionItemProvider,
    filterAsync,
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

    const allChildFolderItems = await filterAsync(
        (
            await promisify(readdir)(parentFolder)
        ).map((itemName) => resolve(parentFolder, itemName)),
        async (item) => (await promisify(lstat)(item)).isDirectory()
    );

    return (
        await Promise.all(
            allChildFolderItems.map(async (folderPath) => {
                return {
                    folderPath,
                    settingsFile: await getFolderSettingsFilePath(folderPath),
                    sequence: await getSequenceForFolder(
                        collection.getRootDirectory(),
                        folderPath
                    ),
                };
            })
        )
    ).filter(({ sequence }) => sequence != undefined) as {
        folderPath: string;
        settingsFile: string;
        sequence: number;
    }[];
}
