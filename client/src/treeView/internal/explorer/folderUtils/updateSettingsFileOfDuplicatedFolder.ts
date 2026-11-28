import { basename, dirname } from "path";
import {
    BrunoFileType,
    getFolderSettingsFilePath,
    getSequenceForFolder,
    getStoredItemNameFromFile,
} from "@global_shared";
import {
    getMaxSequenceForFolders,
    getSequenceStepFromSettings,
    TypedCollectionItemProvider,
} from "@shared";
import { replaceItemName } from "../fileUtils/replaceItemName";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { getStoredNameForCopiedItem } from "../sequencePrefixUtils/getStoredNameForCopiedItem";

/**
 * Has to be called after the original folder has already been copied to the new location.
 * Adjusts the name (and the sequence, if the original folder has one) in the copied folder settings file.
 */
export async function updateSettingsFileOfDuplicatedFolder(
    itemProvider: TypedCollectionItemProvider,
    originalPath: string,
    newFolderPath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(originalPath);

    if (!collection) {
        return;
    }

    const format = collection.getFormat();
    const newFolderSettingsFile = await getFolderSettingsFilePath(
        false,
        newFolderPath,
        format,
    );

    if (!newFolderSettingsFile) {
        return;
    }

    const originalSequence = await getSequenceForFolder(
        collection.getRootDirectory(),
        originalPath,
        format,
    );

    await replaceItemName(
        newFolderSettingsFile,
        getStoredNameForCopiedItem(basename(newFolderPath), {
            name: basename(originalPath),
            sequence: originalSequence,
            storedName: await getStoredItemNameFromFile(newFolderSettingsFile),
        }),
        BrunoFileType.FolderSettingsFile,
        format,
    );

    if (originalSequence !== undefined) {
        await replaceSequenceForFile(
            newFolderSettingsFile,
            ((await getMaxSequenceForFolders(
                itemProvider,
                dirname(originalPath),
            )) ?? 0) + getSequenceStepFromSettings(),
        );
    }
}
