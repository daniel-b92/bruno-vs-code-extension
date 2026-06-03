import { dirname, extname } from "path";
import {
    checkIfPathExistsAsync,
    getExtensionForBrunoFiles,
    normalizePath,
    doesFileNameMatchFolderSettingsFileName,
    isInFolderForEnvironmentFiles,
    BrunoFileType,
    ItemType,
    NonBrunoSpecificItemType,
    doesFileNameMatchCollectionSettingsFile,
    ReadyOnlyCollection,
} from "../..";
import {
    getFileSystemDataPath,
    getFileSystemDataStats,
} from "../../fileSystemCache/internal/fileSystemDataUtils";
import { FileSystemData } from "../../fileSystemCache/internal/interfaces";

export async function getItemType<T>(
    collection: ReadyOnlyCollection<T>,
    fileSystemData: FileSystemData,
    validateExistence = true,
): Promise<ItemType | undefined> {
    const path = getFileSystemDataPath(fileSystemData);

    if (validateExistence && !(await checkIfPathExistsAsync(path))) {
        return undefined;
    }

    const isValidBruFile =
        extname(path) == getExtensionForBrunoFiles() &&
        normalizePath(path).startsWith(
            normalizePath(collection.getRootDirectory()),
        );

    if (!isValidBruFile) {
        const stats = await getFileSystemDataStats(fileSystemData);

        return stats === undefined
            ? undefined
            : stats.isFile()
              ? NonBrunoSpecificItemType.OtherFileType
              : stats.isDirectory()
                ? // Some files from external packages are neither seen as files nor directories.
                  NonBrunoSpecificItemType.Directory
                : undefined;
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
    collection: ReadyOnlyCollection<T>,
    path: string,
) {
    return collection.isRootDirectory(dirname(path));
}
