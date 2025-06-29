import { lstatSync } from "fs";
import * as vscode from "vscode";
import { FileChangeType } from "../../fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "../../fileSystem/collectionWatcher";
import { CollectionRegistry } from "../internalHelpers/collectionRegistry";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { CollectionFile } from "../../model/collectionFile";
import { CollectionDirectory } from "../../model/collectionDirectory";
import { Collection } from "../../model/collection";
import { CollectionData } from "../../model/interfaces";
import { TestRunnerDataHelper } from "./testRunnerDataHelper";
import { addItemToCollection } from "../internalHelpers/addItemToCollection";
import { registerMissingCollectionsAndTheirItems } from "../internalHelpers/registerMissingCollectionsAndTheirItems";
import { getSequenceFromMetaBlock, OutputChannelLogger } from "../..";
import { basename } from "path";

export class CollectionItemProvider {
    constructor(
        collectionWatcher: CollectionWatcher,
        private testRunnerDataHelper: TestRunnerDataHelper,
        private getPathsToIgnoreForCollection: (
            collectionRootDir: string
        ) => string[],
        private logger?: OutputChannelLogger
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
                const registeredCollection = this.getAncestorCollectionForPath(
                    uri.fsPath
                );

                if (!registeredCollection) {
                    return;
                }

                if (
                    registeredCollection.isRootDirectory(uri.fsPath) &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `Got notification for deletion of collection '${uri.fsPath}'.`
                    );
                    this.handleCollectionDeletion(uri);
                    return;
                }

                const maybeRegisteredData =
                    registeredCollection.getStoredDataForPath(uri.fsPath);

                if (
                    !maybeRegisteredData &&
                    fileChangeType == FileChangeType.Created &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `Got notification for new created item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

                    this.handleItemCreation(registeredCollection, uri.fsPath);
                    return;
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `Got notification for deletion of cached item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

                    this.handleItemDeletion(
                        registeredCollection,
                        maybeRegisteredData
                    );
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Modified &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `Got notification for modification of cached item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

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

    public getAncestorCollectionForPath(itemPath: string) {
        return this.getRegisteredCollections().find((collection) =>
            normalizeDirectoryPath(itemPath).startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        );
    }

    public async refreshCache() {
        this.collectionRegistry
            .getRegisteredCollections()
            .forEach((collection) => {
                this.collectionRegistry.unregisterCollection(
                    collection.getRootDirectory()
                );
            });

        await registerMissingCollectionsAndTheirItems(
            this.testRunnerDataHelper,
            this.collectionRegistry,
            this.getPathsToIgnoreForCollection
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
            : new CollectionFile(itemPath, getSequenceFromMetaBlock(itemPath));

        this.itemUpdateEmitter.fire({
            collection: registeredCollection,
            data: addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollection,
                item
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
            const newSequence = getSequenceFromMetaBlock(oldItem.getPath());
            const newItem = new CollectionFile(oldItem.getPath(), newSequence);

            registeredCollectionForItem.removeTestItemAndDescendants(oldItem);

            addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollectionForItem,
                newItem
            );

            this.itemUpdateEmitter.fire({
                collection: registeredCollectionForItem,
                data: { item: newItem, treeItem, testItem },
                updateType: FileChangeType.Modified,
                changedData: { sequenceChanged: oldSequence != newSequence },
            });
        }
    }
}
