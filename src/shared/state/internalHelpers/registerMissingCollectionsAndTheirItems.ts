import { lstatSync, readdirSync } from "fs";
import { getAllCollectionRootDirectories } from "../../fileSystem/util/collectionRootFolderHelper";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { TestRunnerDataHelper } from "../..";
import { Collection } from "../../model/collection";
import { CollectionRegistry } from "./collectionRegistry";
import { resolve } from "path";
import { CollectionDirectory } from "../../model/collectionDirectory";
import { CollectionFile } from "../../model/collectionFile";
import { getSequence } from "../../fileParsing/testFileParser";
import { addItemToCollection } from "./addItemToCollection";

export async function registerMissingCollectionsAndTheirItems(
    testRunnerDataHelper: TestRunnerDataHelper,
    collectionRegistry: CollectionRegistry
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

                if (!collection.getStoredDataForPath(path)) {
                    const item = isDirectory
                        ? new CollectionDirectory(path)
                        : new CollectionFile(path, getSequence(path));

                    addItemToCollection(testRunnerDataHelper, collection, item);
                }

                if (isDirectory) {
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
