import { getSequenceForFolder, normalizeDirectoryPath } from "@global_shared";
import {
    Collection,
    CollectionDirectory,
    getAllCollectionRootDirectories,
    TestRunnerDataHelper,
} from "@shared";
import { CollectionRegistry } from "./collectionRegistry";
import { resolve } from "path";
import { addItemToCollection } from "./addItemToCollection";
import { lstat, readdir } from "fs";
import { promisify } from "util";
import { getCollectionFile } from "./getCollectionFile";

export async function registerMissingCollectionsAndTheirItems(
    testRunnerDataHelper: TestRunnerDataHelper,
    collectionRegistry: CollectionRegistry,
    filePathsToIgnore: RegExp[],
) {
    const allCollections = await registerAllExistingCollections(
        testRunnerDataHelper,
        collectionRegistry,
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
                    const item = isDirectory
                        ? new CollectionDirectory(
                              path,
                              await getSequenceForFolder(
                                  collection.getRootDirectory(),
                                  path,
                              ),
                          )
                        : await getCollectionFile(collection, path);

                    if (item) {
                        addItemToCollection(
                            testRunnerDataHelper,
                            collection,
                            item,
                        );
                    }
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

async function registerAllExistingCollections(
    testRunnerDataHelper: TestRunnerDataHelper,
    registry: CollectionRegistry,
) {
    return (await getAllCollectionRootDirectories()).map((rootDirectory) => {
        const collection = new Collection(rootDirectory, testRunnerDataHelper);

        if (
            !registry
                .getRegisteredCollections()
                .some(
                    (registered) =>
                        normalizeDirectoryPath(registered.getRootDirectory()) ==
                        normalizeDirectoryPath(rootDirectory),
                )
        ) {
            registry.registerCollection(collection);
        }

        return collection;
    });
}

function shouldPathBeIgnored(filePathsToIgnore: RegExp[], path: string) {
    return filePathsToIgnore.some((patternToIgnore) =>
        path.match(patternToIgnore),
    );
}
