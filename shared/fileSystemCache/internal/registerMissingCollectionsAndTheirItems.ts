import {
    normalizeDirectoryPath,
    getAllCollectionRootDirectories,
    Collection,
    AdditionalCollectionDataProvider,
    getFolderSettingsFilePath,
    CollectionDirectory,
    getAdditionalCollectionData,
    Logger,
} from "../..";
import { CollectionRegistry } from "./collectionRegistry";
import { resolve } from "path";
import { addOrReplaceItemInCollection } from "./addOrReplaceItemInCollection";
import { lstat, readdir } from "fs";
import { promisify } from "util";
import { createCollectionDirectoryInstance } from "./createCollectionDirectoryInstance";

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

    for (const collection of allCollections) {
        const currentPaths = [collection.getRootDirectory()];

        while (currentPaths.length > 0) {
            const currentPath = currentPaths.splice(0, 1)[0];
            const childrenNames = await promisify(readdir)(currentPath).catch(
                () => undefined,
            );

            if (childrenNames === undefined) {
                continue;
            }

            for (const childItem of childrenNames) {
                const path = resolve(currentPath, childItem);
                const isDirectory = await promisify(lstat)(path)
                    .then((stats) => stats.isDirectory())
                    .catch(() => undefined);

                if (isDirectory === undefined) {
                    continue;
                }

                if (
                    !collection.getStoredDataForPath(path) &&
                    !shouldPathBeIgnored(filePathsToIgnore, path)
                ) {
                    await addOrReplaceItemInCollection<T>({
                        collection,
                        path,
                        additionalDataProvider,
                    });
                }

                if (
                    isDirectory &&
                    !shouldPathBeIgnored(filePathsToIgnore, path)
                ) {
                    currentPaths.push(path);
                }
            }
        }
    }
}

async function registerAllExistingCollections<T>(
    registry: CollectionRegistry<T>,
    workspaceFolders: string[],
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
) {
    const rootFolders = await getAllCollectionRootDirectories(workspaceFolders);

    return (
        await Promise.all(
            rootFolders.map(async (rootDirectory) => {
                const normalizedRootDir = normalizeDirectoryPath(rootDirectory);
                const rootFolderItem = await createCollectionDirectoryInstance(
                    normalizedRootDir,
                    await getFolderSettingsFilePath(true, rootDirectory),
                );

                const collection = rootFolderItem
                    ? await createCollectionInstance(
                          rootFolderItem,
                          additionalDataProvider,
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
                                normalizeDirectoryPath(
                                    registered.getRootDirectory(),
                                ) == normalizedRootDir,
                        )
                ) {
                    registry.registerCollection(collection);
                }

                return collection;
            }),
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
) {
    const additionalData = await getAdditionalCollectionData(
        rootFolderItem,
        additionalDataProvider,
    );

    return new Collection(rootFolderItem, additionalData);
}
