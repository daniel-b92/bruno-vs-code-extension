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
    normalizeDirectoryPath,
    OutputChannelLogger,
    TestRunnerDataHelper,
    MultiFileOperationWithStatus,
} from "../..";
import { basename, dirname } from "path";
import { promisify } from "util";
import { lstat } from "fs";
import { getCollectionFile } from "../internalHelpers/getCollectionFile";

interface NotificationData {
    collection: Collection;
    data: CollectionData;
    updateType: FileChangeType;
    changedData?: { sequenceChanged?: boolean };
}

export class CollectionItemProvider {
    constructor(
        collectionWatcher: CollectionWatcher,
        private testRunnerDataHelper: TestRunnerDataHelper,
        private filePathsToIgnore: RegExp[],
        multiFileOperationSubscription: vscode.Event<MultiFileOperationWithStatus>,
        private logger?: OutputChannelLogger,
    ) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = new vscode.EventEmitter<NotificationData[]>();
        this.disposables = [];

        this.disposables.push(
            collectionWatcher.subscribeToUpdates()(
                async ({ uri, changeType: fileChangeType }) => {
                    const registeredCollection =
                        this.getAncestorCollectionForPath(uri.fsPath);

                    if (!registeredCollection) {
                        return;
                    }

                    if (
                        registeredCollection.isRootDirectory(uri.fsPath) &&
                        fileChangeType == FileChangeType.Deleted &&
                        !this.shouldPathBeIgnored(uri.fsPath)
                    ) {
                        this.logger?.info(
                            `${this.commonPreMessageForLogging} Handling deletion of collection '${uri.fsPath}'.`,
                        );
                        this.handleCollectionDeletion(uri);
                        return;
                    }

                    const maybeRegisteredData =
                        registeredCollection.getStoredDataForPath(uri.fsPath);

                    if (
                        !maybeRegisteredData &&
                        fileChangeType == FileChangeType.Created &&
                        !this.shouldPathBeIgnored(uri.fsPath)
                    ) {
                        this.logger?.info(
                            `${this.commonPreMessageForLogging} creation of item '${
                                uri.fsPath
                            }' in collection '${basename(
                                registeredCollection.getRootDirectory(),
                            )}'.`,
                        );

                        await this.handleItemCreation(
                            registeredCollection,
                            uri.fsPath,
                        );
                    } else if (
                        maybeRegisteredData &&
                        fileChangeType == FileChangeType.Deleted &&
                        !this.shouldPathBeIgnored(uri.fsPath)
                    ) {
                        this.logger?.info(
                            `${this.commonPreMessageForLogging} deletion of item '${
                                uri.fsPath
                            }' in collection '${basename(
                                registeredCollection.getRootDirectory(),
                            )}'.`,
                        );

                        await this.handleItemDeletion(
                            testRunnerDataHelper,
                            registeredCollection,
                            maybeRegisteredData,
                        );
                    } else if (
                        maybeRegisteredData &&
                        fileChangeType == FileChangeType.Modified &&
                        !this.shouldPathBeIgnored(uri.fsPath)
                    ) {
                        this.logger?.info(
                            `${
                                this.commonPreMessageForLogging
                            } modification of item '${
                                uri.fsPath
                            }' in collection '${basename(
                                registeredCollection.getRootDirectory(),
                            )}'.`,
                        );

                        await this.handleModificationOfRegisteredItem(
                            registeredCollection,
                            maybeRegisteredData,
                        );
                    }
                },
            ),
        );

        this.disposables.push(
            multiFileOperationSubscription(({ parentFolder, running }) => {
                if (running) {
                    logger?.debug(
                        `Got notification for active multi file operation in folder '${parentFolder}'`,
                    );
                    this.activeMultiFileOperationFolder = parentFolder;
                } else {
                    logger?.debug(
                        `Got notification for finished multi file operation in folder '${parentFolder}'`,
                    );
                    this.activeMultiFileOperationFolder = undefined;
                }
            }),
        );
    }

    private disposables: vscode.Disposable[];
    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<NotificationData[]>;
    private notificationBatch: NotificationData[] = [];
    private notificationSendEventTimer: NodeJS.Timeout | undefined = undefined;
    private activeMultiFileOperationFolder: string | undefined = undefined;
    private readonly commonPreMessageForLogging = "[CollectionItemProvider]";

    public async waitForItemsToBeRegisteredInCache(
        collectionRootFolder: string,
        items: { path: string; sequence?: number }[],
        timeoutInMillis = 5_000,
    ) {
        const startTime = performance.now();

        // Multi file operations often cause the cache to not be in sync with the file system for a little while.
        // Therefore, wait until the operation is completed before continuing.
        await new Promise<void>((resolve) => {
            if (
                !this.activeMultiFileOperationFolder ||
                !items.some(({ path }) =>
                    path.startsWith(
                        normalizeDirectoryPath(
                            this.activeMultiFileOperationFolder as string,
                        ),
                    ),
                )
            ) {
                resolve();
            }
        });

        let timeout: NodeJS.Timeout | undefined = undefined;
        let disposable: vscode.Disposable | undefined = undefined;

        const toAwait = new Promise<boolean>((resolve) => {
            const collection = this.getRegisteredCollections().find(
                (c) =>
                    normalizeDirectoryPath(c.getRootDirectory()) ==
                    normalizeDirectoryPath(collectionRootFolder),
            );

            if (!collection) {
                this.logger?.warn(
                    `Collection with root folder '${collectionRootFolder}' not found in list of registered collections.`,
                );
                return resolve(false);
            }

            const missingItems = items.filter(({ path, sequence }) => {
                const registeredItem = this.getRegisteredItem(collection, path);
                return (
                    !registeredItem ||
                    (sequence && registeredItem.item.getSequence() !== sequence)
                );
            });

            if (missingItems.length == 0) {
                this.logger?.trace(
                    `Cached items ${JSON.stringify(
                        items.map(({ path }) => path),
                        null,
                        2,
                    )} already up to date on first check.`,
                );

                return resolve(true);
            }

            const initialMissingItems = [...missingItems];

            disposable = this.subscribeToUpdates()((updates) => {
                for (const {
                    updateType,
                    data: { item },
                } of updates) {
                    if (
                        [
                            FileChangeType.Created,
                            FileChangeType.Modified,
                        ].includes(updateType) &&
                        missingItems.some(({ path }) => path == item.getPath())
                    ) {
                        const index = missingItems.findIndex(
                            ({ path }) => path == item.getPath(),
                        );

                        const expectedSequence = missingItems[index].sequence;

                        if (
                            !expectedSequence ||
                            expectedSequence === item.getSequence()
                        ) {
                            missingItems.splice(index, 1);

                            if (missingItems.length == 0) {
                                break;
                            }
                        }
                    }
                }

                if (missingItems.length == 0) {
                    this.logger?.trace(
                        `Waited for ${Math.round(performance.now() - startTime)} / ${timeoutInMillis} ms for items ${JSON.stringify(
                            initialMissingItems.map(({ path }) => path),
                            null,
                            2,
                        )} to be registered in cache.`,
                    );
                    return resolve(true);
                }
            });

            timeout = setTimeout(() => {
                this.logger?.debug(
                    `Timeout of ${timeoutInMillis} ms reached while waiting for items '${JSON.stringify(items, null, 2)}' to be registered in cache.`,
                );
                return resolve(false);
            }, timeoutInMillis);
        });

        const result = await toAwait;

        if (disposable) {
            (disposable as vscode.Disposable).dispose();
        }

        clearTimeout(timeout);

        return result;
    }

    public subscribeToUpdates() {
        return this.itemUpdateEmitter.event;
    }

    public getRegisteredCollections() {
        return this.collectionRegistry.getRegisteredCollections();
    }

    public getRegisteredItemAndCollection(path: string) {
        const collection = this.getAncestorCollectionForPath(path);

        const registeredData = collection
            ? this.getRegisteredItem(collection, path)
            : undefined;

        return collection && registeredData
            ? { collection, data: registeredData }
            : undefined;
    }

    public getRegisteredItem(collection: Collection, itemPath: string) {
        if (
            !this.collectionRegistry
                .getRegisteredCollections()
                .some(
                    (registered) =>
                        normalizeDirectoryPath(registered.getRootDirectory()) ==
                        normalizeDirectoryPath(collection.getRootDirectory()),
                )
        ) {
            throw new Error(
                `Given collection with root directory '${collection.getRootDirectory()}' is not registered. Cannot search for registered items within the given collection.`,
            );
        }

        return collection.getStoredDataForPath(itemPath);
    }

    public getAncestorCollectionForPath(itemPath: string) {
        return this.getRegisteredCollections().find((collection) =>
            normalizeDirectoryPath(itemPath).startsWith(
                normalizeDirectoryPath(collection.getRootDirectory()),
            ),
        );
    }

    public async refreshCache() {
        const startTime = performance.now();

        this.collectionRegistry
            .getRegisteredCollections()
            .forEach((collection) => {
                this.collectionRegistry.unregisterCollection(
                    collection.getRootDirectory(),
                );
            });

        await registerMissingCollectionsAndTheirItems(
            this.testRunnerDataHelper,
            this.collectionRegistry,
            this.filePathsToIgnore,
        );

        const endTime = performance.now();
        this.logger?.info(
            `${this.commonPreMessageForLogging} Cache refresh duration: ${Math.round(
                endTime - startTime,
            )} ms`,
        );
    }

    public dispose() {
        if (this.notificationSendEventTimer) {
            clearTimeout(this.notificationSendEventTimer);
        }

        this.collectionRegistry.dispose();
        this.itemUpdateEmitter.dispose();
        this.notificationBatch.splice(0);

        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private handleCollectionDeletion(collectionUri: vscode.Uri) {
        const registeredCollection =
            this.collectionRegistry.unregisterCollection(collectionUri.fsPath);

        if (registeredCollection) {
            this.itemUpdateEmitter.fire([
                {
                    collection: registeredCollection,
                    data: registeredCollection.getStoredDataForPath(
                        registeredCollection.getRootDirectory(),
                    ) as CollectionData,
                    updateType: FileChangeType.Deleted,
                },
            ]);
        }
    }

    private async handleItemCreation(
        registeredCollection: Collection,
        itemPath: string,
    ) {
        const item: CollectionItem = (
            await promisify(lstat)(itemPath)
        ).isDirectory()
            ? new CollectionDirectory(
                  itemPath,
                  await getSequenceForFolder(
                      registeredCollection.getRootDirectory(),
                      itemPath,
                  ),
              )
            : await getCollectionFile(registeredCollection, itemPath);

        const collectionData = addItemToCollection(
            this.testRunnerDataHelper,
            registeredCollection,
            item,
        );

        await this.addToNotificationBatchForItemCreation(
            registeredCollection,
            collectionData,
        );
    }

    private async handleItemDeletion(
        testRunnerDataHelper: TestRunnerDataHelper,
        registeredCollectionForItem: Collection,
        data: CollectionData,
    ) {
        const { item } = data;
        if (
            item instanceof CollectionFile &&
            item.getFileType() == BrunoFileType.FolderSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(item.getPath()),
                );

            if (parentFolderData) {
                this.handleFolderSequenceUpdate(
                    testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData,
                );
            }
        }

        registeredCollectionForItem.removeTestItemAndDescendants(item);

        this.itemUpdateEmitter.fire([
            {
                collection: registeredCollectionForItem,
                data,
                updateType: FileChangeType.Deleted,
            },
        ]);
    }

    private async handleModificationOfRegisteredItem(
        registeredCollectionForItem: Collection,
        collectionData: CollectionData,
    ) {
        const { item: modifiedItem, treeItem, testItem } = collectionData;
        const itemPath = modifiedItem.getPath();

        const newSequence = await parseSequenceFromMetaBlock(itemPath);

        if (
            modifiedItem instanceof CollectionFile &&
            modifiedItem.getFileType() == BrunoFileType.FolderSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(itemPath),
                );

            if (parentFolderData) {
                this.handleFolderSequenceUpdate(
                    this.testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData,
                    newSequence,
                );
            }
        } else if (
            modifiedItem instanceof CollectionFile &&
            modifiedItem.getFileType() == BrunoFileType.RequestFile
        ) {
            const newItem = await getCollectionFile(
                registeredCollectionForItem,
                itemPath,
            );

            registeredCollectionForItem.removeTestItemAndDescendants(
                modifiedItem,
            );

            addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollectionForItem,
                newItem,
            );

            this.itemUpdateEmitter.fire([
                {
                    collection: registeredCollectionForItem,
                    data: { item: newItem, treeItem, testItem },
                    updateType: FileChangeType.Modified,
                    changedData: {
                        sequenceChanged:
                            modifiedItem.getSequence() != newSequence,
                    },
                },
            ]);
        }
    }

    private handleFolderSequenceUpdate(
        testRunnerDataHelper: TestRunnerDataHelper,
        collection: Collection,
        oldFolderData: CollectionData,
        newSequence?: number,
    ) {
        const folderPath = oldFolderData.item.getPath();
        const oldSequence = oldFolderData.item.getSequence();

        collection.removeTestItemIfRegistered(folderPath);

        const newFolderItem = new CollectionDirectory(folderPath, newSequence);

        this.itemUpdateEmitter.fire([
            {
                collection,
                data: addItemToCollection(
                    testRunnerDataHelper,
                    collection,
                    newFolderItem,
                ),
                updateType: FileChangeType.Modified,
                changedData: { sequenceChanged: oldSequence != newSequence },
            },
        ]);
    }

    private async addToNotificationBatchForItemCreation(
        collection: Collection,
        data: CollectionData,
    ) {
        const path = data.item.getPath();
        const isDirectory = (await promisify(lstat)(path)).isDirectory();

        if (
            this.notificationBatch.some(
                ({ data: { item } }) =>
                    normalizeDirectoryPath(item.getPath()) ==
                    normalizeDirectoryPath(path),
            )
        ) {
            return;
        }

        if (
            !isDirectory &&
            collection.getStoredDataForPath(dirname(path)) &&
            this.notificationBatch.length == 0
        ) {
            // If the item is only a file and the parent folder is already registered and no notification batch is active,
            // chances are that only a file was created, so we just immediatly fire the notification.
            this.itemUpdateEmitter.fire([
                {
                    collection,
                    data,
                    updateType: FileChangeType.Created,
                },
            ]);
        } else {
            this.notificationBatch.push({
                collection,
                data,
                updateType: FileChangeType.Created,
            });

            if (
                isDirectory ||
                !collection.getStoredDataForPath(dirname(path))
            ) {
                // If the item is folder or a file without a registered parent folder,
                // it's most likely a folder that has been created with several descendant items where more creation events are most likely still to come.
                this.resetSendEventTimer();
            }
        }
    }

    private resetSendEventTimer() {
        if (this.notificationSendEventTimer) {
            this.notificationSendEventTimer.refresh();
        } else {
            this.notificationSendEventTimer = setTimeout(() => {
                const notificationData = this.notificationBatch
                    .splice(0)
                    .sort(
                        (
                            { data: { item: item1 } },
                            { data: { item: item2 } },
                        ) => (item1.getPath() < item2.getPath() ? -1 : 1),
                    );

                this.logger?.debug(
                    `${this.commonPreMessageForLogging} Firing event for a batch of ${notificationData.length} created items.`,
                );

                this.itemUpdateEmitter.fire(notificationData);
            }, 500);
        }
    }

    private shouldPathBeIgnored(path: string) {
        return this.filePathsToIgnore.some((patternToIgnore) =>
            path.match(patternToIgnore),
        );
    }
}
