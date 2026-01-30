import { lstat, readdir } from "fs";
import {
    getFolderSettingsFilePath,
    getSequenceForFolder,
} from "@global_shared";
import { CollectionItemProvider, filterAsync } from "@shared";
import { resolve } from "path";
import { promisify } from "util";

export async function getSequencesForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string,
): Promise<{ folderPath: string; settingsFile: string; sequence: number }[]> {
    const collection = itemProvider.getAncestorCollectionForPath(parentFolder);

    if (!collection || !collection.getStoredDataForPath(parentFolder)) {
        return [];
    }

    const allChildItems = await promisify(readdir)(parentFolder)
        .then((names) => names.map((name) => resolve(parentFolder, name)))
        .catch(() => undefined);

    const allChildFolderItems =
        allChildItems && allChildItems.length > 0
            ? await filterAsync(
                  allChildItems,
                  async (item) =>
                      await promisify(lstat)(item)
                          .then((stats) => stats.isDirectory())
                          .catch(() => false),
              )
            : [];

    return (
        await Promise.all(
            allChildFolderItems.map(async (folderPath) => {
                return {
                    folderPath,
                    settingsFile: await getFolderSettingsFilePath(folderPath),
                    sequence: await getSequenceForFolder(
                        collection.getRootDirectory(),
                        folderPath,
                    ),
                };
            }),
        )
    ).filter(({ sequence }) => sequence != undefined) as {
        folderPath: string;
        settingsFile: string;
        sequence: number;
    }[];
}
