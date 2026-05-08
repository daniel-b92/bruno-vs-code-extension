import {
    normalizePath,
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
import { readdir } from "fs";
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
    const names = await promisify(readdir)(directory, {
        recursive: true,
        encoding: "utf-8",
    }).catch(() => undefined);

    return names?.map((name) => resolve(directory, name));
}

async function registerItems<T>(
    collection: Collection<T>,
    filePathsToIgnore: RegExp[],
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
    paths: string[],
) {
    Promise.all(
        paths
            .filter(
                (path) =>
                    !collection.getStoredDataForPath(path) &&
                    !shouldPathBeIgnored(filePathsToIgnore, path),
            )
            .map(
                async (path) =>
                    await addOrReplaceItemInCollection<T>({
                        collection,
                        path,
                        additionalDataProvider,
                    }),
            ),
    );
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
                const normalizedRootDir = normalizePath(rootDirectory);
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
                                normalizePath(registered.getRootDirectory()) ==
                                normalizedRootDir,
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
        true,
    );

    return new Collection(rootFolderItem, additionalData);
}
