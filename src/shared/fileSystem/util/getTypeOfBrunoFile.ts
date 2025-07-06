import { basename, dirname, extname } from "path";
import {
    BrunoFileType,
    Collection,
    getExtensionForRequestFiles,
    isFolderSettingsFile,
    normalizeDirectoryPath,
} from "../..";
import { existsSync } from "fs";

export function getTypeOfBrunoFile(
    collectionsToSearch: Collection[],
    path: string
): BrunoFileType | undefined {
    if (!existsSync(path)) {
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
    } else if (isFolderSettingsFile(path)) {
        return BrunoFileType.FolderSettingsFile;
    } else if (isCollectionSettingsFile(collectionsToSearch, path)) {
        return BrunoFileType.CollectionSettingsFile;
    } else {
        return BrunoFileType.RequestFile;
    }
}

function isEnvironmentFile(path: string) {
    return normalizeDirectoryPath(dirname(path)).match(
        /(\/|\\)environments(\/|\\)$/
    );
}

function isCollectionSettingsFile(
    registeredCollections: Collection[],
    path: string
) {
    return (
        basename(path) == "collection.bru" &&
        registeredCollections.some(
            (collection) =>
                normalizeDirectoryPath(collection.getRootDirectory()) ==
                normalizeDirectoryPath(dirname(path))
        )
    );
}
