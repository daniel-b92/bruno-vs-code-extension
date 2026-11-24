import {
    CollectionDirectory,
    CollectionItem,
    getStoredItemNameFromFile,
} from "@global_shared";

/** The name that is stored in the file of the request or app, or in the settings file of the folder (if there is one). */
export async function getStoredNameOfItem(item: CollectionItem) {
    const path =
        item instanceof CollectionDirectory
            ? item.getSettingsFilePath()
            : item.getPath();

    return path === undefined
        ? undefined
        : await getStoredItemNameFromFile(path);
}
