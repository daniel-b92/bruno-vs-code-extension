import { TestCollection } from "../testData/testCollection";
import { TestController, Uri } from "vscode";
import { getTestId } from "./utils/testTreeHelper";
import { handleTestFileCreationOrUpdate } from "./handlers/handleTestFileCreationOrUpdate";
import { addAllTestItemsForCollections } from "./testItemAdding/addAllTestItemsForCollections";
import { handleTestItemDeletion } from "./handlers/handleTestItemDeletion";
import { isValidTestFileFromCollections } from "./utils/isValidTestFileFromCollections";
import { getTestFileDescendants } from "../../shared/fileSystem/util/getTestFileDescendants";
import { addTestDirectoryAndAllDescendants } from "./testItemAdding/addTestDirectoryAndAllDescendants";
import { TestDirectory } from "../testData/testDirectory";
import { dirname } from "path";
import { lstatSync } from "fs";
import { CollectionWatcher } from "../../shared/fileSystem/collectionWatcher";
import { FileChangeType } from "../../shared/definitions";
import { normalizeDirectoryPath } from "../../shared/fileSystem/util/normalizeDirectoryPath";

export class CollectionRegistry {
    constructor(
        private controller: TestController,
        private collectionWatcher: CollectionWatcher
    ) {
        collectionWatcher
            .subscribeToUpdates()
            .event(async ({ uri, changeType }) => {
                const registeredCollection = this.getCurrentCollections().find(
                    (collection) =>
                        uri.fsPath.startsWith(
                            normalizeDirectoryPath(collection.rootDirectory)
                        ) || uri.fsPath == collection.rootDirectory
                );

                if (!registeredCollection) {
                    return;
                }

                if (changeType == FileChangeType.Created) {
                    if (
                        isValidTestFileFromCollections(
                            uri,
                            this.getCurrentCollections()
                        )
                    ) {
                        handleTestFileCreationOrUpdate(
                            this.controller,
                            registeredCollection,
                            uri
                        );
                    } else if (
                        await this.hasValidTestFileDescendantsFromCollections(
                            uri,
                            this.getCurrentCollections()
                        )
                    ) {
                        await addTestDirectoryAndAllDescendants(
                            this.controller,
                            registeredCollection,
                            new TestDirectory(uri.fsPath)
                        );
                    }
                } else if (changeType == FileChangeType.Modified) {
                    /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the
                new name and a deletion of the directory with the old name. Creating or deleting a directory will be handled by the  'onDidCreate' or
                'onDidDelete' functions.*/
                    if (
                        isValidTestFileFromCollections(
                            uri,
                            this.getCurrentCollections()
                        )
                    ) {
                        handleTestFileCreationOrUpdate(
                            this.controller,
                            registeredCollection,
                            uri
                        );
                    } else {
                        // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                        handleTestItemDeletion(
                            this.controller,
                            registeredCollection,
                            uri
                        );
                    }
                } else if (changeType == FileChangeType.Deleted) {
                    if (uri.fsPath == registeredCollection.rootDirectory) {
                        this.unregisterCollection(registeredCollection);
                        return;
                    }

                    handleTestItemDeletion(
                        this.controller,
                        registeredCollection,
                        uri
                    );
                }
            });
    }

    private registeredCollections: TestCollection[] = [];

    public getCurrentCollections() {
        return this.registeredCollections;
    }

    public async registerCollection(collection: TestCollection) {
        this.collectionWatcher.startWatchingCollection(
            collection.rootDirectory
        );
        this.registeredCollections.push(collection);
        await addAllTestItemsForCollections(this.controller, [collection]);
    }

    public unregisterCollection(collection: TestCollection) {
        if (
            !this.registeredCollections.some(
                (registered) =>
                    registered.rootDirectory == collection.rootDirectory
            )
        ) {
            console.warn(
                `Collection to unregister not found in collection registry: '${JSON.stringify(
                    collection,
                    null,
                    2
                )}'`
            );
        } else {
            this.registeredCollections.splice(
                this.registeredCollections.findIndex(
                    (col) => col.rootDirectory == collection.rootDirectory
                ),
                1
            );

            this.collectionWatcher.stopWatchingCollection(
                collection.rootDirectory
            );
            this.controller.items.delete(
                getTestId(Uri.file(collection.rootDirectory))
            );
        }
    }

    private async hasValidTestFileDescendantsFromCollections(
        uri: Uri,
        knownCollections: TestCollection[]
    ) {
        if (!lstatSync(uri.fsPath).isDirectory()) {
            return false;
        }

        const collection = knownCollections.find((collection) => {
            let currentPath = uri.fsPath;

            while (
                currentPath != collection.rootDirectory &&
                currentPath.length >= collection.rootDirectory.length
            ) {
                currentPath = dirname(currentPath);
            }

            return (
                normalizeDirectoryPath(currentPath) ==
                normalizeDirectoryPath(collection.rootDirectory)
            );
        });

        if (!collection) {
            return false;
        }

        return (await getTestFileDescendants(uri.fsPath)).length > 0;
    }
}
