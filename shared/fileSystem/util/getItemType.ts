import { dirname, extname } from "path";
import { promisify } from "util";
import { lstat } from "fs";
import {
    checkIfPathExistsAsync,
    getExtensionForBrunoFiles,
    normalizePath,
    doesFileNameMatchFolderSettingsFileName,
    isInFolderForEnvironmentFiles,
    BrunoFileType,
    Collection,
    ItemType,
    NonBrunoSpecificItemType,
    doesFileNameMatchCollectionSettingsFile,
} from "../..";

export async function getItemType<T>(
    collection: Collection<T>,
    path: string,
): Promise<ItemType | undefined> {
    if (!(await checkIfPathExistsAsync(path))) {
        return undefined;
    }

    const isValidBruFile =
        extname(path) == getExtensionForBrunoFiles() &&
        normalizePath(path).startsWith(
            normalizePath(collection.getRootDirectory()),
        );

    if (!isValidBruFile) {
        return promisify(lstat)(path)
            .then((stats) =>
                stats.isFile()
                    ? NonBrunoSpecificItemType.OtherFileType
                    : stats.isDirectory()
                      ? // Some files from external packages are neither seen as files nor directories.
                        NonBrunoSpecificItemType.Directory
                      : undefined,
            )
            .catch(() => undefined);
    }

    if (isInFolderForEnvironmentFiles(path)) {
        return BrunoFileType.EnvironmentFile;
    } else if (
        isChildElementOfCollectionRootDirectory(collection, path) &&
        doesFileNameMatchCollectionSettingsFile(path)
    ) {
        return BrunoFileType.CollectionSettingsFile;
    } else if (
        !isChildElementOfCollectionRootDirectory(collection, path) &&
        doesFileNameMatchFolderSettingsFileName(path)
    ) {
        return BrunoFileType.FolderSettingsFile;
    } else {
        return BrunoFileType.RequestFile;
    }
}

function isChildElementOfCollectionRootDirectory<T>(
    collection: Collection<T>,
    path: string,
) {
    return collection.isRootDirectory(dirname(path));
}
