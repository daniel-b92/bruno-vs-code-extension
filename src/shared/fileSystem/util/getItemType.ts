import { basename, dirname, extname } from "path";
import {
    BrunoFileType,
    Collection,
    getExtensionForBrunoFiles,
    doesFileNameMatchFolderSettingsFileName,
    normalizeDirectoryPath,
    checkIfPathExistsAsync,
    ItemType,
    NonBrunoSpecificItemType,
} from "../..";
import { promisify } from "util";
import { lstat } from "fs";

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
        return (await promisify(lstat)(path)).isFile()
            ? NonBrunoSpecificItemType.OtherFileType
            : NonBrunoSpecificItemType.Directory;
    }

    if (isEnvironmentFile(path)) {
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

function isEnvironmentFile(path: string) {
    return normalizeDirectoryPath(dirname(path)).match(
        /(\/|\\)environments(\/|\\)$/,
    );
}

function doesNameMatchCollectionSettingsFile(path: string) {
    return basename(path) == "collection.bru";
}
