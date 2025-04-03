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
import { dirname, resolve } from "path";
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
            changedData?: { sequenceChanged?: boolean };
        }>();

        collectionWatcher.subscribeToUpdates()(
            ({ uri, changeType: fileChangeType }) => {
                const registeredCollection =
                    this.getRegisteredCollectionForItem(uri.fsPath);

                if (!registeredCollection) {
                    return;
                }

                if (
                    registeredCollection.isRootDirectory(uri.fsPath) &&
                    fileChangeType == FileChangeType.Deleted
                ) {
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
        changedData?: { sequenceChanged?: boolean };
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

        if (item instanceof CollectionFile && item.getSequence() != undefined) {
            this.addTestItemsForAllAncestorsIfNotExisting(
                registeredCollection,
                item as CollectionFile
            );
        }

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
        const { item: oldItem, treeItem, testItem } = collectionData;

        if (oldItem instanceof CollectionFile) {
            const oldSequence = oldItem.getSequence();
            const newSequence = getSequence(oldItem.getPath());
            const newItem = new CollectionFile(oldItem.getPath(), newSequence);

            if (oldSequence == undefined && newSequence != undefined) {
                this.addTestItemsForAllAncestorsIfNotExisting(
                    registeredCollectionForItem,
                    newItem
                );
            }

            registeredCollectionForItem.removeTestItemAndDescendants(oldItem);

            registeredCollectionForItem.addItem(
                newItem,
                this.testRunnerDataHelper
            );

            this.itemUpdateEmitter.fire({
                collection: registeredCollectionForItem,
                data: { item: newItem, treeItem, testItem },
                updateType: FileChangeType.Modified,
                changedData: { sequenceChanged: oldSequence != newSequence },
            });
        }
    }

    private addTestItemsForAllAncestorsIfNotExisting(
        registeredCollectionForItem: Collection,
        item: CollectionFile
    ) {
        const normalizedCollectionPath = normalizeDirectoryPath(
            registeredCollectionForItem.getRootDirectory()
        );

        let currentPath = dirname(item.getPath());

        while (
            normalizeDirectoryPath(currentPath).length >
            normalizedCollectionPath.length
        ) {
            const currentData =
                registeredCollectionForItem.getStoredDataForPath(currentPath);

            if (currentData && !currentData.testItem) {
                registeredCollectionForItem.removeTestItemIfRegistered(
                    currentPath
                );
                registeredCollectionForItem.addItem(
                    currentData.item,
                    this.testRunnerDataHelper,
                    true
                );
            }

            currentPath = dirname(currentPath);
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
