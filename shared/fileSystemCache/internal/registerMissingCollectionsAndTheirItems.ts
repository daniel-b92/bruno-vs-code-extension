import {
    normalizePath,
    getAllCollectionRootDirectories,
    Collection,
    AdditionalCollectionDataProvider,
    getFolderSettingsFilePath,
    CollectionDirectory,
    getAdditionalCollectionData,
    Logger,
    getItemType,
    doesFileNameMatchFolderSettingsFileName,
} from "../..";
import { CollectionRegistry } from "./collectionRegistry";
import { addOrReplaceCollectionData } from "./addOrReplaceItemInCollection";
import { Dirent, readdir } from "fs";
import { promisify } from "util";
import { createCollectionDirectoryInstance } from "./createCollectionDirectoryInstance";
import { getFileSystemDataPath } from "./fileSystemDataUtils";
import { getCollectionItemForFile } from "./getCollectionItem";
import { dirname } from "path";

export async function registerMissingCollectionsAndTheirItems<T>(
    collectionRegistry: CollectionRegistry<T>,
    workspaceFolders: string[],
    filePathsToIgnore: RegExp[],
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
    logger?: Logger,
) {
    const allCollections = await registerAllExistingCollections(
        collectionRegistry,
        workspaceFolders,
        additionalDataProvider,
    );

    logger?.debug(
        `Found collection root folders: ${JSON.stringify(
            allCollections.map((col) => col.getRootDirectory()),
            null,
            2,
        )}`,
    );

    const toAwait = allCollections.map((collection) =>
        getDescendants(collection.getRootDirectory()).then((descendants) => {
            if (descendants != undefined) {
                return registerItems(
                    collection,
                    filePathsToIgnore,
                    additionalDataProvider,
                    descendants,
                );
            }
        }),
    );

    await Promise.all(toAwait);
}

async function getDescendants(directory: string) {
    return await promisify(readdir)(directory, {
        recursive: true,
        withFileTypes: true,
    }).catch(() => undefined);
}

async function registerItems<T>(
    collection: Collection<T>,
    filePathsToIgnore: RegExp[],
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
    fileSystemEntries: Dirent<string>[],
) {
    const isCollectionRoot = false;
    const mappedFileSystemEntries = fileSystemEntries.map((entry) => ({
        entry,
        path: getFileSystemDataPath(entry),
    }));
    const allFolderSettingsFiles = mappedFileSystemEntries.filter(
        ({ entry, path }) =>
            entry.isFile() && doesFileNameMatchFolderSettingsFileName(path),
    );

    await Promise.all(
        mappedFileSystemEntries
            .filter(({ path }) => {
                return (
                    !collection.getStoredDataForPath(path) &&
                    !shouldPathBeIgnored(filePathsToIgnore, path)
                );
            })
            .map(async ({ entry, path }) => {
                // Skip validation if path exists, since should already have been done earlier.
                // This would also take up extra time, when calling this function multiple times for many items.
                const itemType = await getItemType(collection, entry, false);

                const normalized = normalizePath(path);

                if (!itemType) {
                    return undefined;
                }
                const item = entry.isFile()
                    ? await getCollectionItemForFile(path, itemType)
                    : await createCollectionDirectoryInstance(
                          path,
                          allFolderSettingsFiles.find(
                              ({ path: p }) =>
                                  normalizePath(dirname(p)) == normalized,
                          )?.path,
                      );

                if (!item) {
                    return undefined;
                }

                const additionalData = await getAdditionalCollectionData(
                    item,
                    additionalDataProvider,
                    isCollectionRoot,
                );

                return addOrReplaceCollectionData<T>({
                    collection,
                    data: { item, additionalData },
                    additionalDataProvider,
                });
            }),
    );
}

async function registerAllExistingCollections<T>(
    registry: CollectionRegistry<T>,
    workspaceFolders: string[],
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
) {
    const rootFoldersWithData =
        await getAllCollectionRootDirectories(workspaceFolders);

    return (
        await Promise.all(
            rootFoldersWithData.map(
                async ({ rootFolder, additionalContextRoots }) => {
                    const normalizedRootDir = normalizePath(rootFolder);
                    const rootFolderItem =
                        await createCollectionDirectoryInstance(
                            normalizedRootDir,
                            await getFolderSettingsFilePath(true, rootFolder),
                        );

                    const collection = rootFolderItem
                        ? await createCollectionInstance(
                              rootFolderItem,
                              additionalDataProvider,
                              additionalContextRoots,
                          )
                        : undefined;

                    if (!collection) {
                        return undefined;
                    }

                    if (
                        !registry
                            .getRegisteredCollections()
                            .some(
                                (registered) =>
                                    normalizePath(
                                        registered.getRootDirectory(),
                                    ) == normalizedRootDir,
                            )
                    ) {
                        registry.registerCollection(collection);
                    }

                    return collection;
                },
            ),
        )
    ).filter((val) => val != undefined);
}

function shouldPathBeIgnored(filePathsToIgnore: RegExp[], path: string) {
    return filePathsToIgnore.some((patternToIgnore) =>
        path.match(patternToIgnore),
    );
}

async function createCollectionInstance<T>(
    rootFolderItem: CollectionDirectory,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
    additionalContextRoots?: string[],
) {
    const additionalData = await getAdditionalCollectionData(
        rootFolderItem,
        additionalDataProvider,
        true,
    );

    return new Collection(
        rootFolderItem,
        additionalData,
        additionalContextRoots ?? [],
    );
}
