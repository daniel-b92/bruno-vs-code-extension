import * as vscode from "vscode";
import { CollectionRegistry } from "../internalHelpers/collectionRegistry";
import { addItemToCollection } from "../internalHelpers/addItemToCollection";
import { registerMissingCollectionsAndTheirItems } from "../internalHelpers/registerMissingCollectionsAndTheirItems";
import {
    BrunoFileType,
    Collection,
    CollectionData,
    CollectionDirectory,
    CollectionFile,
    CollectionItem,
    CollectionWatcher,
    FileChangeType,
    getSequenceForFolder,
    parseSequenceFromMetaBlock,
    getTypeOfBrunoFile,
    normalizeDirectoryPath,
    OutputChannelLogger,
    TestRunnerDataHelper,
    getSequenceForFile,
} from "../..";
import { basename, dirname } from "path";
import { promisify } from "util";
import { lstat } from "fs";

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
            remainingEvents: number;
        }>();

        collectionWatcher.subscribeToUpdates()(async (events) => {
            const sortedEvents = events.sort(({ uri: uri1 }, { uri: uri2 }) =>
                uri1 <= uri2 ? -1 : 1
            );

            for (let i = 0; i < sortedEvents.length; i++) {
                const { uri, changeType: fileChangeType } = sortedEvents[i];
                const remainingEvents = sortedEvents.length - i - 1;

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
                        `${this.commonPreMessageForLogging} Handling deletion of collection '${uri.fsPath}'.`
                    );
                    this.handleCollectionDeletion(uri, remainingEvents);
                    return;
                }

                const maybeRegisteredData =
                    registeredCollection.getStoredDataForPath(uri.fsPath);

                if (
                    !maybeRegisteredData &&
                    fileChangeType == FileChangeType.Created &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath) &&
                    registeredCollection.getStoredDataForPath(
                        dirname(uri.fsPath)
                    )
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} creation of item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

                    await this.handleItemCreation(
                        registeredCollection,
                        uri.fsPath,
                        remainingEvents
                    );
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} deletion of item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

                    await this.handleItemDeletion(
                        testRunnerDataHelper,
                        registeredCollection,
                        maybeRegisteredData,
                        remainingEvents
                    );
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Modified &&
                    !this.getPathsToIgnoreForCollection(
                        registeredCollection.getRootDirectory()
                    ).includes(uri.fsPath)
                ) {
                    this.logger?.info(
                        `${
                            this.commonPreMessageForLogging
                        } modification of item '${
                            uri.fsPath
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory()
                        )}'.`
                    );

                    await this.handleModificationOfRegisteredItem(
                        registeredCollection,
                        maybeRegisteredData,
                        remainingEvents
                    );
                }
            }
        });
    }

    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<{
        collection: Collection;
        data: CollectionData;
        updateType: FileChangeType;
        remainingEvents: number;
        changedData?: { sequenceChanged?: boolean };
    }>;

    private commonPreMessageForLogging = "[CollectionItemProvider]";

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
        const startTime = performance.now();

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

        const endTime = performance.now();
        this.logger?.info(
            `${this.commonPreMessageForLogging} Cache refresh duration: ${
                endTime - startTime
            } ms`
        );
    }

    private handleCollectionDeletion(
        collectionUri: vscode.Uri,
        remainingEvents: number
    ) {
        const registeredCollection =
            this.collectionRegistry.unregisterCollection(collectionUri.fsPath);

        if (registeredCollection) {
            this.itemUpdateEmitter.fire({
                collection: registeredCollection,
                data: registeredCollection.getStoredDataForPath(
                    registeredCollection.getRootDirectory()
                ) as CollectionData,
                updateType: FileChangeType.Deleted,
                remainingEvents,
            });
        }
    }

    private async handleItemCreation(
        registeredCollection: Collection,
        itemPath: string,
        remainingEvents: number
    ) {
        const item: CollectionItem = (
            await promisify(lstat)(itemPath)
        ).isDirectory()
            ? new CollectionDirectory(
                  itemPath,
                  await getSequenceForFolder(
                      registeredCollection.getRootDirectory(),
                      itemPath
                  )
              )
            : new CollectionFile(
                  itemPath,
                  await getSequenceForFile(registeredCollection, itemPath)
              );

        this.itemUpdateEmitter.fire({
            collection: registeredCollection,
            data: addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollection,
                item
            ),
            updateType: FileChangeType.Created,
            remainingEvents,
        });
    }

    private async handleItemDeletion(
        testRunnerDataHelper: TestRunnerDataHelper,
        registeredCollectionForItem: Collection,
        data: CollectionData,
        remainingEvents: number
    ) {
        const { item } = data;
        if (
            (await getTypeOfBrunoFile(
                [registeredCollectionForItem],
                item.getPath()
            )) == BrunoFileType.FolderSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(item.getPath())
                );

            if (parentFolderData) {
                this.handleFolderSequenceUpdate(
                    testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData,
                    remainingEvents
                );
            }
        }

        registeredCollectionForItem.removeTestItemAndDescendants(item);

        this.itemUpdateEmitter.fire({
            collection: registeredCollectionForItem,
            data,
            updateType: FileChangeType.Deleted,
            remainingEvents,
        });
    }

    private async handleModificationOfRegisteredItem(
        registeredCollectionForItem: Collection,
        collectionData: CollectionData,
        remainingEvents: number
    ) {
        const { item: modifiedItem, treeItem, testItem } = collectionData;
        const itemPath = modifiedItem.getPath();

        const fileType = await getTypeOfBrunoFile(
            [registeredCollectionForItem],
            itemPath
        );
        const newSequence = await parseSequenceFromMetaBlock(itemPath);

        if (
            modifiedItem instanceof CollectionFile &&
            fileType == BrunoFileType.FolderSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(itemPath)
                );

            if (parentFolderData) {
                this.handleFolderSequenceUpdate(
                    this.testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData,
                    remainingEvents,
                    newSequence
                );
            }
        } else if (
            modifiedItem instanceof CollectionFile &&
            fileType == BrunoFileType.RequestFile
        ) {
            const newItem = new CollectionFile(itemPath, newSequence);

            registeredCollectionForItem.removeTestItemAndDescendants(
                modifiedItem
            );

            addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollectionForItem,
                newItem
            );

            this.itemUpdateEmitter.fire({
                collection: registeredCollectionForItem,
                data: { item: newItem, treeItem, testItem },
                updateType: FileChangeType.Modified,
                changedData: {
                    sequenceChanged: modifiedItem.getSequence() != newSequence,
                },
                remainingEvents,
            });
        }
    }

    private handleFolderSequenceUpdate(
        testRunnerDataHelper: TestRunnerDataHelper,
        collection: Collection,
        oldFolderData: CollectionData,
        remainingEvents: number,
        newSequence?: number
    ) {
        const folderPath = oldFolderData.item.getPath();
        const oldSequence = oldFolderData.item.getSequence();

        collection.removeTestItemIfRegistered(folderPath);

        const newFolderItem = new CollectionDirectory(folderPath, newSequence);

        this.itemUpdateEmitter.fire({
            collection,
            data: addItemToCollection(
                testRunnerDataHelper,
                collection,
                newFolderItem
            ),
            updateType: FileChangeType.Modified,
            changedData: { sequenceChanged: oldSequence != newSequence },
            remainingEvents,
        });
    }
}
