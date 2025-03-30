import { lstatSync, readdirSync } from "fs";
import * as vscode from "vscode";
import { getSequence } from "../fileSystem/testFileParsing/testFileParser";
import { FileChangeType } from "../fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "../fileSystem/collectionWatcher";
import { CollectionRegistry } from "./collectionRegistry";
import { normalizeDirectoryPath } from "../fileSystem/util/normalizeDirectoryPath";
import { CollectionFile } from "./model/collectionFile";
import { CollectionDirectory } from "./model/collectionDirectory";
import { getAllCollectionRootDirectories } from "../fileSystem/util/collectionRootFolderHelper";
import { Collection } from "./model/collection";
import { resolve } from "path";
import { CollectionData } from "./model/interfaces";
import { TestRunnerDataHelper } from "./testRunnerDataHelper";

export class CollectionItemProvider {
    constructor(
        collectionWatcher: CollectionWatcher,
        private testRunnerDataHelper: TestRunnerDataHelper
    ) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = new vscode.EventEmitter<{
            collection: Collection;
            data: CollectionData;
            updateType: FileChangeType;
            changedData?: { sequence?: number };
        }>();

        collectionWatcher.subscribeToUpdates()(
            ({ uri, changeType: fileChangeType }) => {
                const registeredCollection =
                    this.getRegisteredCollectionForItem(uri.fsPath);

                if (!registeredCollection) {
                    return;
                }

                const isCollection =
                    normalizeDirectoryPath(uri.fsPath) ==
                    normalizeDirectoryPath(
                        registeredCollection.getRootDirectory()
                    );

                if (isCollection && fileChangeType == FileChangeType.Deleted) {
                    this.handleCollectionDeletion(uri);
                    return;
                }

                const maybeRegisteredData =
                    registeredCollection.getStoredDataForPath(uri.fsPath);

                if (
                    !maybeRegisteredData &&
                    fileChangeType == FileChangeType.Created
                ) {
                    this.handleItemCreation(registeredCollection, uri.fsPath);
                    return;
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Deleted
                ) {
                    this.handleItemDeletion(
                        registeredCollection,
                        maybeRegisteredData
                    );
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Modified
                ) {
                    this.handleModificationOfRegisteredItem(
                        registeredCollection,
                        maybeRegisteredData
                    );
                }
            }
        );
    }

    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<{
        collection: Collection;
        data: CollectionData;
        updateType: FileChangeType;
        changedData?: { sequence?: number };
    }>;

    public subscribeToUpdates() {
        return this.itemUpdateEmitter.event;
    }

    public getRegisteredCollections() {
        return this.collectionRegistry.getRegisteredCollections();
    }

    public getRegisteredItem(collection: Collection, itemPath: string) {
        if (
            !this.collectionRegistry
                .getRegisteredCollections()
                .some(
                    (registered) =>
                        normalizeDirectoryPath(registered.getRootDirectory()) ==
                        normalizeDirectoryPath(collection.getRootDirectory())
                )
        ) {
            throw new Error(
                `Given collection with root directory '${collection.getRootDirectory()}' is not registered. Cannot search for registered items within the given collection.`
            );
        }

        return collection.getStoredDataForPath(itemPath);
    }

    public getRegisteredCollectionForItem(itemPath: string) {
        return this.getRegisteredCollections().find((collection) =>
            normalizeDirectoryPath(itemPath).startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        );
    }

    public async registerMissingCollectionsAndTheirItems() {
        const allCollections = await this.registerAllExistingCollections();

        for (const collection of allCollections) {
            const currentPaths = [collection.getRootDirectory()];

            while (currentPaths.length > 0) {
                const currentPath = currentPaths.splice(0, 1)[0];

                for (const childItem of readdirSync(currentPath)) {
                    const path = resolve(currentPath, childItem);
                    const isDirectory = lstatSync(path).isDirectory();

                    if (!collection.getStoredDataForPath(path)) {
                        collection.addItem(
                            isDirectory
                                ? new CollectionDirectory(path)
                                : new CollectionFile(path, getSequence(path)),
                            this.testRunnerDataHelper
                        );
                    }

                    if (isDirectory) {
                        currentPaths.push(path);
                    }
                }
            }
            this.testRunnerDataHelper.addTestTreeItemsForDirectoryAndDescendants(
                collection,
                (
                    collection.getStoredDataForPath(
                        collection.getRootDirectory()
                    ) as CollectionData
                ).item as CollectionDirectory
            );
        }
    }

    private async registerAllExistingCollections() {
        return (await getAllCollectionRootDirectories()).map(
            (rootDirectory) => {
                const collection = new Collection(rootDirectory);

                if (
                    !this.collectionRegistry
                        .getRegisteredCollections()
                        .some(
                            (registered) =>
                                normalizeDirectoryPath(
                                    registered.getRootDirectory()
                                ) == normalizeDirectoryPath(rootDirectory)
                        )
                ) {
                    this.collectionRegistry.registerCollection(collection);
                }

                return collection;
            }
        );
    }

    private handleCollectionDeletion(collectionUri: vscode.Uri) {
        const registeredCollection =
            this.collectionRegistry.unregisterCollection(collectionUri.fsPath);

        if (registeredCollection) {
            this.itemUpdateEmitter.fire({
                collection: registeredCollection,
                data: registeredCollection.getStoredDataForPath(
                    registeredCollection.getRootDirectory()
                ) as CollectionData,
                updateType: FileChangeType.Deleted,
            });
        }
    }

    private handleItemCreation(
        registeredCollection: Collection,
        itemPath: string
    ) {
        const item: CollectionFile | CollectionDirectory = lstatSync(
            itemPath
        ).isDirectory()
            ? new CollectionDirectory(itemPath)
            : new CollectionFile(itemPath, getSequence(itemPath));

        this.itemUpdateEmitter.fire({
            collection: registeredCollection,
            data: registeredCollection.addItem(
                item,
                this.testRunnerDataHelper,
                this.isRunnable(registeredCollection, item)
            ),
            updateType: FileChangeType.Created,
        });
    }

    private handleItemDeletion(
        registeredCollectionForItem: Collection,
        data: CollectionData
    ) {
        registeredCollectionForItem.removeTestItemAndDescendants(data.item);

        this.itemUpdateEmitter.fire({
            collection: registeredCollectionForItem,
            data,
            updateType: FileChangeType.Deleted,
        });
    }

    private handleModificationOfRegisteredItem(
        registeredCollectionForItem: Collection,
        collectionData: CollectionData
    ) {
        const { item } = collectionData;
        const newSequence = getSequence(item.getPath());

        if (
            item instanceof CollectionFile &&
            item.getSequence() != newSequence
        ) {
            registeredCollectionForItem.removeTestItemAndDescendants(item);

            registeredCollectionForItem.addItem(
                new CollectionFile(item.getPath(), newSequence),
                this.testRunnerDataHelper
            );

            this.itemUpdateEmitter.fire({
                collection: registeredCollectionForItem,
                data: collectionData,
                updateType: FileChangeType.Modified,
                changedData: { sequence: newSequence },
            });
        }
    }

    private isRunnable(
        registeredCollection: Collection,
        item: CollectionFile | CollectionDirectory
    ) {
        return (
            (item instanceof CollectionFile &&
                item.getSequence() != undefined) ||
            (item instanceof CollectionDirectory &&
                registeredCollection
                    .getAllStoredDataForCollection()
                    .some(
                        ({ item: registeredItem }) =>
                            registeredItem
                                .getPath()
                                .startsWith(
                                    normalizeDirectoryPath(item.getPath())
                                ) &&
                            registeredItem instanceof CollectionFile &&
                            registeredItem.getSequence() != undefined
                    ))
        );
    }
}
