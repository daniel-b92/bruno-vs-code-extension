import { CollectionRegistry } from "../internal/collectionRegistry";
import { addItemToCollection } from "../internal/addItemToCollection";
import { registerMissingCollectionsAndTheirItems } from "../internal/registerMissingCollectionsAndTheirItems";
import {
    getSequenceForFolder,
    parseSequenceFromMetaBlock,
    normalizeDirectoryPath,
    CollectionWatcher,
    FileChangeType,
    BrunoFileType,
    Collection,
    CollectionData,
    CollectionDirectory,
    CollectionItemWithSequence,
    isCollectionItemWithSequence,
    CollectionItem,
    Logger,
} from "../..";
import { basename, dirname } from "path";
import { promisify } from "util";
import { lstat } from "fs";
import { getCollectionFile } from "../internal/getCollectionFile";
import { isModifiedItemOutdated } from "../internal/isModifiedItemOutdated";
import { Evt } from "evt";

export interface NotificationData<T> {
    collection: Collection<T>;
    data: CollectionData<T>;
    updateType: FileChangeType;
    changedData?: { sequenceChanged?: boolean; tagsChanged?: boolean };
}

export class CollectionItemProvider<T> {
    constructor(
        collectionWatcher: CollectionWatcher,
        private additionalCollectionDataCreator: (item: CollectionItem) => T,
        private filePathsToIgnore: RegExp[],
        private logger?: Logger,
    ) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = Evt.create<NotificationData<T>[]>();

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
    }

    private collectionRegistry: CollectionRegistry<T>;
    private itemUpdateEmitter: Evt<NotificationData<T>[]>;
    private itemUpdateEmitterContext = Evt.newCtx();
    private notificationBatch: NotificationData<T>[] = [];
    private notificationSendEventTimer: NodeJS.Timeout | undefined = undefined;
    private readonly commonPreMessageForLogging = "[CollectionItemProvider]";

    public subscribeToUpdates(callback: (e: NotificationData<T>[]) => void) {
        this.itemUpdateEmitter.attach(this.itemUpdateEmitterContext, callback);
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

    public getRegisteredItem(collection: Collection<T>, itemPath: string) {
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

    public async refreshCache(workSpaceFolders: string[]) {
        const startTime = performance.now();

        this.collectionRegistry
            .getRegisteredCollections()
            .forEach((collection) => {
                this.collectionRegistry.unregisterCollection(
                    collection.getRootDirectory(),
                );
            });

        await registerMissingCollectionsAndTheirItems(
            this.collectionRegistry,
            workSpaceFolders,
            this.filePathsToIgnore,
            this.additionalCollectionDataCreator,
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
        this.itemUpdateEmitterContext.done();
        this.notificationBatch.splice(0);
    }

    private handleCollectionDeletion(collectionRootDir: string) {
        const registeredCollection =
            this.collectionRegistry.unregisterCollection(collectionRootDir);

        if (registeredCollection) {
            this.handleOutboundNotification({
                collection: registeredCollection,
                data: registeredCollection.getStoredDataForPath(
                    registeredCollection.getRootDirectory(),
                ) as CollectionData<T>,
                updateType: FileChangeType.Deleted,
            });
        }
    }

    private async handleItemCreation(
        registeredCollection: Collection<T>,
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
            registeredCollection,
            item,
            this.additionalCollectionDataCreator,
        );

        await this.handleOutboundNotification({
            collection: registeredCollection,
            data: collectionData,
            updateType: FileChangeType.Created,
        });
    }

    private async handleItemDeletion(
        registeredCollectionForItem: Collection<T>,
        data: CollectionData<T>,
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
        registeredCollectionForItem: Collection<T>,
        collectionData: CollectionData<T>,
    ) {
        const { item: modifiedItem, additionalData } = collectionData;
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
                registeredCollectionForItem,
                newItem,
                this.additionalCollectionDataCreator,
            );

            const {
                details: {
                    sequenceOutdated: isSequenceOutdated,
                    tagsOutdated: areTagsOutdated,
                },
            } = isModifiedItemOutdated(modifiedItem, newItem);

            await this.handleOutboundNotification({
                collection: registeredCollectionForItem,
                data: { item: newItem, additionalData },
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
        collection: Collection<T>,
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
                collection,
                newFolderItem,
                this.additionalCollectionDataCreator,
            ),
            updateType: FileChangeType.Modified,
            changedData: { sequenceChanged: oldSequence != newSequence },
        });
    }

    private async handleOutboundNotification(
        notificationData: NotificationData<T>,
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

                this.itemUpdateEmitter.post(notificationData);
            }, timeout);
        }
    }

    private shouldPathBeIgnored(path: string) {
        return this.filePathsToIgnore.some((patternToIgnore) =>
            path.match(patternToIgnore),
        );
    }
}
