import { basename, dirname, extname } from "path";
import {
    BrunoFileType,
    Collection,
    getExtensionForRequestFiles,
    doesFileNameMatchFolderSettingsFileName,
    normalizeDirectoryPath,
    checkIfPathExistsAsync,
} from "../..";

export async function getTypeOfBrunoFile(
    collectionsToSearch: Collection[],
    path: string
): Promise<BrunoFileType | undefined> {
    if (!(await checkIfPathExistsAsync(path))) {
        return undefined;
    }

    const isValidBruFile =
        extname(path) == getExtensionForRequestFiles() &&
        collectionsToSearch.some((collection) =>
            path.startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        );

    if (!isValidBruFile) {
        return undefined;
    }

    if (isEnvironmentFile(path)) {
        return BrunoFileType.EnvironmentFile;
    } else if (
        isChildElementOfCollectionRootDirectory(collectionsToSearch, path) &&
        doesNameMatchCollectionSettingsFile(path)
    ) {
        return BrunoFileType.CollectionSettingsFile;
    } else if (
        !isChildElementOfCollectionRootDirectory(collectionsToSearch, path) &&
        doesFileNameMatchFolderSettingsFileName(path)
    ) {
        return BrunoFileType.FolderSettingsFile;
    } else {
        return BrunoFileType.RequestFile;
    }
}

function isChildElementOfCollectionRootDirectory(
    registeredCollections: Collection[],
    path: string
) {
    return registeredCollections.some(
        (collection) =>
            normalizeDirectoryPath(collection.getRootDirectory()) ==
            normalizeDirectoryPath(dirname(path))
    );
}

function isEnvironmentFile(path: string) {
    return normalizeDirectoryPath(dirname(path)).match(
        /(\/|\\)environments(\/|\\)$/
    );
}

function doesNameMatchCollectionSettingsFile(path: string) {
    return basename(path) == "collection.bru";
}
