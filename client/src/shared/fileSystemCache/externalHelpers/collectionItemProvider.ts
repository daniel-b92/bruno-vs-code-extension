import * as vscode from "vscode";
import { CollectionRegistry } from "../internalHelpers/collectionRegistry";
import { addItemToCollection } from "../internalHelpers/addItemToCollection";
import { registerMissingCollectionsAndTheirItems } from "../internalHelpers/registerMissingCollectionsAndTheirItems";
import {
    getSequenceForFolder,
    parseSequenceFromMetaBlock,
    normalizeDirectoryPath,
    CollectionWatcher,
    FileChangeType,
} from "@global_shared";
import {
    BrunoFileType,
    Collection,
    CollectionData,
    CollectionDirectory,
    CollectionItemWithSequence,
    OutputChannelLogger,
    TestRunnerDataHelper,
    isCollectionItemWithSequence,
    MultiFileOperationWithStatus,
} from "@shared";
import { basename, dirname } from "path";
import { promisify } from "util";
import { lstat } from "fs";
import { getCollectionFile } from "../internalHelpers/getCollectionFile";
import { determineFilesToCheckWhetherInSync } from "../internalHelpers/determineFilesToCheckWhetherInSync";
import {
    ResultCode,
    waitForFilesFromFolderToBeInSync,
} from "../internalHelpers/waitForFilesFromFolderToBeInSync";
import { isModifiedItemOutdated } from "../internalHelpers/isModifiedItemOutdated";

export interface NotificationData {
    collection: Collection;
    data: CollectionData;
    updateType: FileChangeType;
    changedData?: { sequenceChanged?: boolean; tagsChanged?: boolean };
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

        collectionWatcher.subscribeToUpdates(
            async ({ path, changeType: fileChangeType }) => {
                const registeredCollection =
                    this.getAncestorCollectionForPath(path);

                if (!registeredCollection) {
                    return;
                }

                if (
                    registeredCollection.isRootDirectory(path) &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.shouldPathBeIgnored(path)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} Handling deletion of collection '${path}'.`,
                    );
                    this.handleCollectionDeletion(path);
                    return;
                }

                const maybeRegisteredData =
                    registeredCollection.getStoredDataForPath(path);

                if (
                    !maybeRegisteredData &&
                    fileChangeType == FileChangeType.Created &&
                    !this.shouldPathBeIgnored(path)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} creation of item '${
                            path
                        }' in collection '${basename(
                            registeredCollection.getRootDirectory(),
                        )}'.`,
                    );

                    await this.handleItemCreation(registeredCollection, path);
                } else if (
                    maybeRegisteredData &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.shouldPathBeIgnored(path)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} deletion of item '${
                            path
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
                    !this.shouldPathBeIgnored(path)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} modification of item '${
                            path
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
        );

        this.multiFileOperationFinishedNotifier =
            new vscode.EventEmitter<string>();

        this.disposables.push(
            this.multiFileOperationFinishedNotifier,
            multiFileOperationSubscription(({ parentFolder, running }) => {
                if (running) {
                    this.latestMultiFileOperation = {
                        folderPath: parentFolder,
                        completionDate: undefined,
                    };
                } else {
                    this.latestMultiFileOperation = {
                        folderPath: parentFolder,
                        completionDate: new Date(),
                    };
                    this.multiFileOperationFinishedNotifier.fire(parentFolder);
                }
            }),
        );
    }

    private disposables: vscode.Disposable[];
    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<NotificationData[]>;
    private notificationBatch: NotificationData[] = [];
    private notificationSendEventTimer: NodeJS.Timeout | undefined = undefined;
    private latestMultiFileOperation: {
        folderPath: string | undefined;
        completionDate: Date | undefined;
    } = { folderPath: undefined, completionDate: undefined };
    private multiFileOperationFinishedNotifier: vscode.EventEmitter<string>;
    private readonly commonPreMessageForLogging = "[CollectionItemProvider]";

    public async waitForFileToBeRegisteredInCache(
        collectionRootFolder: string,
        filePath: string,
        shouldAbortEvent?: vscode.Event<void>,
        timeoutInMillis = 5_000,
    ) {
        let shouldAbort = false;
        if (shouldAbortEvent != undefined) {
            shouldAbortEvent(() => {
                shouldAbort = true;
            });
        }
        const addLogEntryForAbortion = () => {
            this.logger?.debug(
                `${this.commonPreMessageForLogging} Aborting waiting for file '${filePath}' to be registered in cache.`,
            );
        };
        const getCollection = () => {
            return this.getRegisteredCollections().find(
                (c) =>
                    normalizeDirectoryPath(c.getRootDirectory()) ==
                    normalizeDirectoryPath(collectionRootFolder),
            );
        };
        const parentFolder = dirname(filePath);
        const collection = getCollection();

        if (!collection) {
            this.logger?.warn(
                `Collection with root folder '${collectionRootFolder}' not found in list of registered collections.`,
            );
            return Promise.resolve(false);
        }

        if (shouldAbort) {
            addLogEntryForAbortion();
            return false;
        }

        if (
            !this.hasMultiFileOperationRecentlyBeenActive(parentFolder) &&
            (await this.isCachedFileInSync(collection, filePath))
        ) {
            this.logger?.debug(
                `Cached item '${filePath}' already up to date on first check.`,
            );
            return Promise.resolve(true);
        }

        if (shouldAbort) {
            addLogEntryForAbortion();
            return false;
        }

        const startTime = performance.now();

        // Multi file operations often cause the cache to not be in sync with the file system for a little while.
        // Therefore, wait until the operation is completed before continuing and afterwards we wait until all items for files in the folder are in sync.
        const filesToCheck = await determineFilesToCheckWhetherInSync(
            filePath,
            parentFolder,
            collection,
            {
                currentlyActive: (folder) =>
                    this.isMultiFileOperationActive(folder),
                recentlyActive: (folder) =>
                    this.hasMultiFileOperationRecentlyBeenActive(folder),
                multiFileOperationFinishedNotifier:
                    this.multiFileOperationFinishedNotifier.event,
            },
            {
                getRegisteredItem: (collection, path) =>
                    this.getRegisteredItem(collection, path),
            },
            this.logger,
        );

        if (shouldAbort) {
            addLogEntryForAbortion();
            return false;
        }

        const resultCode = await waitForFilesFromFolderToBeInSync(
            filesToCheck,
            parentFolder,
            {
                shouldAbort: () => shouldAbort,
                getSubscriptionForCacheUpdates: () => this.subscribeToUpdates(),
            },
            timeoutInMillis,
            this.logger,
        );

        if (
            resultCode == ResultCode.WaitingCompleted &&
            filesToCheck.length > 0
        ) {
            this.logger?.trace(
                `Waited for ${Math.round(performance.now() - startTime)} / ${timeoutInMillis} ms for items ${JSON.stringify(
                    filesToCheck.map(({ path }) => path),
                    null,
                    2,
                )} to be registered in cache.`,
            );
        }

        return resultCode == ResultCode.WaitingCompleted;
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
                .some((registered) =>
                    registered.isRootDirectory(collection.getRootDirectory()),
                )
        ) {
            this.logger?.warn(
                `Given collection with root directory '${collection.getRootDirectory()}' is not registered. Cannot search for registered items within the given collection.`,
            );
            return undefined;
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
            vscode.workspace.workspaceFolders?.map(
                (folder) => folder.uri.fsPath,
            ) ?? [],
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

    private handleCollectionDeletion(collectionRootDir: string) {
        const registeredCollection =
            this.collectionRegistry.unregisterCollection(collectionRootDir);

        if (registeredCollection) {
            this.handleOutboundNotification({
                collection: registeredCollection,
                data: registeredCollection.getStoredDataForPath(
                    registeredCollection.getRootDirectory(),
                ) as CollectionData,
                updateType: FileChangeType.Deleted,
            });
        }
    }

    private async handleItemCreation(
        registeredCollection: Collection,
        itemPath: string,
    ) {
        const item = await promisify(lstat)(itemPath)
            .then(async (stats) =>
                stats.isDirectory()
                    ? new CollectionDirectory(
                          itemPath,
                          await getSequenceForFolder(
                              registeredCollection.getRootDirectory(),
                              itemPath,
                          ),
                      )
                    : await getCollectionFile(registeredCollection, itemPath),
            )
            .catch(() => undefined);

        if (!item) {
            return;
        }

        const collectionData = addItemToCollection(
            this.testRunnerDataHelper,
            registeredCollection,
            item,
        );

        await this.handleOutboundNotification({
            collection: registeredCollection,
            data: collectionData,
            updateType: FileChangeType.Created,
        });
    }

    private async handleItemDeletion(
        testRunnerDataHelper: TestRunnerDataHelper,
        registeredCollectionForItem: Collection,
        data: CollectionData,
    ) {
        const { item } = data;
        if (
            item.isFile() &&
            item.getItemType() == BrunoFileType.FolderSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(item.getPath()),
                );

            if (
                parentFolderData &&
                isCollectionItemWithSequence(parentFolderData.item)
            ) {
                this.handleFolderSequenceUpdate(
                    testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData.item,
                );
            }
        }

        registeredCollectionForItem.removeTestItemAndDescendants(item);

        await this.handleOutboundNotification({
            collection: registeredCollectionForItem,
            data,
            updateType: FileChangeType.Deleted,
        });
    }

    private async handleModificationOfRegisteredItem(
        registeredCollectionForItem: Collection,
        collectionData: CollectionData,
    ) {
        const { item: modifiedItem, treeItem, testItem } = collectionData;
        const itemPath = modifiedItem.getPath();

        if (!modifiedItem.isFile()) {
            return;
        }

        if (modifiedItem.getItemType() == BrunoFileType.FolderSettingsFile) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(itemPath),
                );

            if (
                parentFolderData &&
                isCollectionItemWithSequence(parentFolderData.item)
            ) {
                this.handleFolderSequenceUpdate(
                    this.testRunnerDataHelper,
                    registeredCollectionForItem,
                    parentFolderData.item,
                    await parseSequenceFromMetaBlock(itemPath),
                );
            }
        } else if (
            modifiedItem.getItemType() == BrunoFileType.EnvironmentFile ||
            (isCollectionItemWithSequence(modifiedItem) &&
                modifiedItem.getItemType() == BrunoFileType.RequestFile)
        ) {
            const newItem = await getCollectionFile(
                registeredCollectionForItem,
                itemPath,
            );

            registeredCollectionForItem.removeTestItemAndDescendants(
                modifiedItem,
            );

            if (!newItem) {
                return;
            }

            addItemToCollection(
                this.testRunnerDataHelper,
                registeredCollectionForItem,
                newItem,
            );

            const {
                details: {
                    sequenceOutdated: isSequenceOutdated,
                    tagsOutdated: areTagsOutdated,
                },
            } = isModifiedItemOutdated(modifiedItem, newItem);

            await this.handleOutboundNotification({
                collection: registeredCollectionForItem,
                data: { item: newItem, treeItem, testItem },
                updateType: FileChangeType.Modified,
                changedData:
                    isSequenceOutdated || areTagsOutdated
                        ? {
                              sequenceChanged: isSequenceOutdated,
                              tagsChanged: areTagsOutdated,
                          }
                        : undefined,
            });
        }
    }

    private handleFolderSequenceUpdate(
        testRunnerDataHelper: TestRunnerDataHelper,
        collection: Collection,
        oldFolderItem: CollectionItemWithSequence,
        newSequence?: number,
    ) {
        const folderPath = oldFolderItem.getPath();
        const oldSequence = oldFolderItem.getSequence();

        collection.removeTestItemIfRegistered(folderPath);

        const newFolderItem = new CollectionDirectory(folderPath, newSequence);

        this.handleOutboundNotification({
            collection,
            data: addItemToCollection(
                testRunnerDataHelper,
                collection,
                newFolderItem,
            ),
            updateType: FileChangeType.Modified,
            changedData: { sequenceChanged: oldSequence != newSequence },
        });
    }

    private async handleOutboundNotification(
        notificationData: NotificationData,
    ) {
        const {
            data: { item },
            updateType,
        } = notificationData;
        const path = item.getPath();

        if (
            this.notificationBatch.some(
                ({ data: { item: i }, updateType: type }) =>
                    normalizeDirectoryPath(i.getPath()) ==
                        normalizeDirectoryPath(path) && type == updateType,
            )
        ) {
            return;
        }

        this.notificationBatch.push(notificationData);
        this.resetSendEventTimer();
    }

    private resetSendEventTimer() {
        if (this.notificationSendEventTimer) {
            this.notificationSendEventTimer.refresh();
        } else {
            const timeout = 200;

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
                    `${this.commonPreMessageForLogging} Firing event for a batch of ${notificationData.length} updated items.`,
                );

                this.itemUpdateEmitter.fire(notificationData);
            }, timeout);
        }
    }

    private shouldPathBeIgnored(path: string) {
        return this.filePathsToIgnore.some((patternToIgnore) =>
            path.match(patternToIgnore),
        );
    }

    private hasMultiFileOperationRecentlyBeenActive(folderPath: string) {
        const maxDiffInMillis = 3_000;

        const hasRecentlyBeenActive =
            this.latestMultiFileOperation.completionDate != undefined &&
            new Date().getTime() <=
                this.latestMultiFileOperation.completionDate.getTime() +
                    maxDiffInMillis;

        return (
            this.isMultiFileOperationActive(folderPath) ||
            (hasRecentlyBeenActive &&
                this.latestMultiFileOperation.folderPath != undefined &&
                normalizeDirectoryPath(
                    this.latestMultiFileOperation.folderPath,
                ) == normalizeDirectoryPath(folderPath))
        );
    }

    private isMultiFileOperationActive(folderPath: string) {
        return (
            this.latestMultiFileOperation.completionDate == undefined &&
            this.latestMultiFileOperation.folderPath != undefined &&
            normalizeDirectoryPath(this.latestMultiFileOperation.folderPath) ==
                normalizeDirectoryPath(folderPath)
        );
    }

    private async isCachedFileInSync(collection: Collection, filePath: string) {
        const cachedData = collection.getStoredDataForPath(filePath);

        return (
            cachedData != undefined &&
            isCollectionItemWithSequence(cachedData.item) &&
            (await parseSequenceFromMetaBlock(filePath)) ==
                cachedData.item.getSequence()
        );
    }
}
