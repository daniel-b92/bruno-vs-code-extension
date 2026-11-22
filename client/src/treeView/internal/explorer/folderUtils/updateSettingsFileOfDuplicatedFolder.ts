import { basename, dirname } from "path";
import {
    BrunoFileType,
    getFolderSettingsFilePath,
    getSequenceForFolder,
} from "@global_shared";
import {
    getMaxSequenceForFolders,
    getSequenceStepFromSettings,
    TypedCollectionItemProvider,
} from "@shared";
import { replaceItemName } from "../fileUtils/replaceItemName";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { getStoredNameForItemName } from "../sequencePrefixUtils/getStoredNameForItemName";

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

    await replaceItemName(
        newFolderSettingsFile,
        getStoredNameForItemName(basename(newFolderPath)),
        BrunoFileType.FolderSettingsFile,
        format,
    );

    if (
        await getSequenceForFolder(
            collection.getRootDirectory(),
            originalPath,
            format,
        )
    ) {
        await replaceSequenceForFile(
            newFolderSettingsFile,
            ((await getMaxSequenceForFolders(
                itemProvider,
                dirname(originalPath),
            )) ?? 0) + getSequenceStepFromSettings(),
        );
    }
}
