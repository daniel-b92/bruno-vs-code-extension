import { lstatSync, readdirSync } from "fs";
import { getAllCollectionRootDirectories } from "../../fileSystem/util/collectionRootFolderHelper";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { getSequenceFromMetaBlock, TestRunnerDataHelper } from "../..";
import { Collection } from "../../model/collection";
import { CollectionRegistry } from "./collectionRegistry";
import { resolve } from "path";
import { CollectionDirectory } from "../../model/collectionDirectory";
import { CollectionFile } from "../../model/collectionFile";
import { addItemToCollection } from "./addItemToCollection";

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

            for (const childItem of readdirSync(currentPath)) {
                const path = resolve(currentPath, childItem);
                const isDirectory = lstatSync(path).isDirectory();

                if (
                    !collection.getStoredDataForPath(path) &&
                    !getPathsToIgnoreForCollection(
                        collection.getRootDirectory()
                    ).includes(path)
                ) {
                    const item = isDirectory
                        ? new CollectionDirectory(path)
                        : new CollectionFile(
                              path,
                              getSequenceFromMetaBlock(path)
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
