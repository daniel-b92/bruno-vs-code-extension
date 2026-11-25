import { dirname } from "path";
import {
    BrunoFileType,
    doesFileNameMatchFolderSettingsFileName,
    isInEnvironmentsFolderOfCollection,
    ItemType,
} from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";

/**
 * The folder whose direct child items may have to be renamed (see `syncSequencePrefixes`) if a file is inserted at or removed from the given path.
 * Folder settings files contain the sequence of their folder, so the folder itself can be affected. They are recognized by their path,
 * since it depends on the location whether a file is a folder settings file (e.g. after moving it).
 *
 * @param fileType The type of the file before or after the change.
 * @returns `undefined` if the file has no influence on sequences.
 */
export function getFolderWithItemsAffectedByFile(
    itemProvider: TypedCollectionItemProvider,
    path: string,
    fileType: ItemType,
): string | undefined {
    const collection = itemProvider.getAncestorCollectionForPath(path);

    if (!collection || isInEnvironmentsFolderOfCollection(collection, path)) {
        return undefined;
    }

    const folder = dirname(path);

    if (
        doesFileNameMatchFolderSettingsFileName(path, collection.getFormat()) &&
        !collection.isRootDirectory(folder)
    ) {
        return dirname(folder);
    }

    return fileType == BrunoFileType.RequestFile ||
        fileType == BrunoFileType.AppFile
        ? folder
        : undefined;
}
