import { dirname, resolve } from "path";
import {
    doesFileNameMatchCollectionSettingsFile,
    doesFileNameMatchFolderSettingsFileName,
    isInEnvironmentsFolderOfCollection,
    ReadyOnlyCollection,
} from "../..";

/**
 * Whether the name has a special meaning at the given location, so that it would determine the type of the item (see `getItemType`) or of the files in it.
 * This applies to settings files and the folder for environment files. The item does not need to exist.
 */
export function isReservedPath<T>(
    collection: ReadyOnlyCollection<T>,
    path: string,
    isFile: boolean,
) {
    if (!isFile) {
        return isInEnvironmentsFolderOfCollection(
            collection,
            resolve(path, "file"),
        );
    }

    return collection.isRootDirectory(dirname(path))
        ? doesFileNameMatchCollectionSettingsFile(path, collection.getFormat())
        : doesFileNameMatchFolderSettingsFileName(path, collection.getFormat());
}
