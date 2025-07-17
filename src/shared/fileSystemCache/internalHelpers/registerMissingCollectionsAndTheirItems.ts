import {
    Collection,
    CollectionDirectory,
    CollectionFile,
    getAllCollectionRootDirectories,
    getSequenceForFile,
    getSequenceForFolder,
    normalizeDirectoryPath,
    TestRunnerDataHelper,
} from "../..";
import { CollectionRegistry } from "./collectionRegistry";
import { resolve } from "path";
import { addItemToCollection } from "./addItemToCollection";
import { lstat, readdir } from "fs";
import { promisify } from "util";

export async function registerMissingCollectionsAndTheirItems(
    testRunnerDataHelper: TestRunnerDataHelper,
    collectionRegistry: CollectionRegistry,
    getPathsToIgnoreForCollection: (collectionRootDir: string) => string[]
) {
    const allCollections = await registerAllExistingCollections(
        testRunnerDataHelper,
        collectionRegistry
    );

    for (const collection of allCollections) {
        const currentPaths = [collection.getRootDirectory()];

        while (currentPaths.length > 0) {
            const currentPath = currentPaths.splice(0, 1)[0];

            for (const childItem of await promisify(readdir)(currentPath)) {
                const path = resolve(currentPath, childItem);
                const isDirectory = (
                    await promisify(lstat)(path)
                ).isDirectory();

                if (
                    !collection.getStoredDataForPath(path) &&
                    !getPathsToIgnoreForCollection(
                        collection.getRootDirectory()
                    ).includes(path)
                ) {
                    const item = isDirectory
                        ? new CollectionDirectory(
                              path,
                              await getSequenceForFolder(
                                  collection.getRootDirectory(),
                                  path
                              )
                          )
                        : new CollectionFile(
                              path,
                              await getSequenceForFile(collection, path)
                          );

                    addItemToCollection(testRunnerDataHelper, collection, item);
                }

                if (
                    isDirectory &&
                    !getPathsToIgnoreForCollection(
                        collection.getRootDirectory()
                    ).includes(path)
                ) {
                    currentPaths.push(path);
                }
            }
        }
    }
}

async function registerAllExistingCollections(
    testRunnerDataHelper: TestRunnerDataHelper,
    registry: CollectionRegistry
) {
    return (await getAllCollectionRootDirectories()).map((rootDirectory) => {
        const collection = new Collection(rootDirectory, testRunnerDataHelper);

        if (
            !registry
                .getRegisteredCollections()
                .some(
                    (registered) =>
                        normalizeDirectoryPath(registered.getRootDirectory()) ==
                        normalizeDirectoryPath(rootDirectory)
                )
        ) {
            registry.registerCollection(collection);
        }

        return collection;
    });
}
