import { basename, dirname, extname } from "path";
import {
    BrunoFileType,
    Collection,
    ItemType,
    NonBrunoSpecificItemType,
    isInFolderForEnvironmentFiles,
} from "@shared";
import { promisify } from "util";
import { lstat } from "fs";
import {
    checkIfPathExistsAsync,
    getExtensionForBrunoFiles,
    normalizeDirectoryPath,
    doesFileNameMatchFolderSettingsFileName,
} from "@global_shared";

export async function getItemType(
    collection: Collection,
    path: string,
): Promise<ItemType | undefined> {
    if (!(await checkIfPathExistsAsync(path))) {
        return undefined;
    }

    const isValidBruFile =
        extname(path) == getExtensionForBrunoFiles() &&
        path.startsWith(normalizeDirectoryPath(collection.getRootDirectory()));

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
        doesNameMatchCollectionSettingsFile(path)
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

function isChildElementOfCollectionRootDirectory(
    collection: Collection,
    path: string,
) {
    return (
        normalizeDirectoryPath(collection.getRootDirectory()) ==
        normalizeDirectoryPath(dirname(path))
    );
}

function doesNameMatchCollectionSettingsFile(path: string) {
    return basename(path) == "collection.bru";
}
