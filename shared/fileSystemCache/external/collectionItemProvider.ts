import { CollectionRegistry } from "../internal/collectionRegistry";
import { addOrReplaceItemInCollection } from "../internal/addOrReplaceItemInCollection";
import { registerMissingCollectionsAndTheirItems } from "../internal/registerMissingCollectionsAndTheirItems";
import {
    normalizePath,
    CollectionWatcher,
    FileChangeType,
    BrunoFileType,
    Collection,
    CollectionData,
    isCollectionItemWithSequence,
    Logger,
    AdditionalCollectionDataProvider,
    getFolderSettingsFilePath,
} from "../..";
import { basename, dirname } from "path";
import { promisify } from "util";
import { lstat } from "fs";
import { getCollectionItem } from "../internal/getCollectionItem";
import { isModifiedItemOutdated } from "../internal/isModifiedItemOutdated";
import { Evt } from "evt";
import { createCollectionDirectoryInstance } from "../internal/createCollectionDirectoryInstance";

export type NotificationData<T> = NotificationBaseData<T> &
    (
        | {
              updateType: FileChangeType.Created | FileChangeType.Deleted;
          }
        | {
              updateType: FileChangeType.Modified;
              changedData?: {
                  sequenceChanged: boolean;
                  tagsChanged: boolean;
                  additionalDataChanged: boolean;
              };
          }
    );

interface NotificationBaseData<T> {
    collection: Collection<T>;
    data: CollectionData<T>;
}

export class CollectionItemProvider<T> {
    constructor(
        collectionWatcher: CollectionWatcher,
        private additionalDataProvider: AdditionalCollectionDataProvider<T>,
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
        this.logger?.debug(
            `Trying to determine ancestor collection for path '${itemPath}'.`,
        );
        return this.getRegisteredCollections().find((collection) =>
            normalizePath(itemPath).startsWith(
                normalizePath(collection.getRootDirectory()),
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
            this.additionalDataProvider,
            this.logger,
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
                    ? await createCollectionDirectoryInstance(
                          itemPath,
                          await getFolderSettingsFilePath(false, itemPath),
                      )
                    : await getCollectionItem(registeredCollection, itemPath),
            )
            .catch(() => undefined);

        if (!item) {
            return;
        }

        const collectionData = await addOrReplaceItemInCollection({
            collection: registeredCollection,
            path: itemPath,
            additionalDataProvider: this.additionalDataProvider,
        });
        if (!collectionData) {
            return;
        }

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
                await this.handleFolderSettingsUpdate(
                    registeredCollectionForItem,
                    parentFolderData,
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
        const { item: modifiedItem } = collectionData;
        const itemPath = modifiedItem.getPath();

        if (!modifiedItem.isFile()) {
            return;
        }

        if (
            modifiedItem.getItemType() == BrunoFileType.FolderSettingsFile ||
            modifiedItem.getItemType() == BrunoFileType.CollectionSettingsFile
        ) {
            const parentFolderData =
                registeredCollectionForItem.getStoredDataForPath(
                    dirname(itemPath),
                );

            if (
                parentFolderData &&
                isCollectionItemWithSequence(parentFolderData.item)
            ) {
                await this.handleFolderSettingsUpdate(
                    registeredCollectionForItem,
                    parentFolderData,
                );
            }
        } else if (
            modifiedItem.getItemType() == BrunoFileType.EnvironmentFile ||
            (isCollectionItemWithSequence(modifiedItem) &&
                modifiedItem.getItemType() == BrunoFileType.RequestFile)
        ) {
            registeredCollectionForItem.removeTestItemAndDescendants(
                modifiedItem,
            );

            const newData = await addOrReplaceItemInCollection({
                collection: registeredCollectionForItem,
                path: itemPath,
                additionalDataProvider: this.additionalDataProvider,
            });

            if (!newData) {
                return;
            }

            const {
                details: {
                    sequenceOutdated,
                    tagsOutdated,
                    additionalDataOutdated,
                },
            } = isModifiedItemOutdated(
                collectionData,
                newData,
                this.additionalDataProvider,
            );

            await this.handleOutboundNotification({
                collection: registeredCollectionForItem,
                data: newData,
                updateType: FileChangeType.Modified,
                changedData:
                    sequenceOutdated || tagsOutdated || additionalDataOutdated
                        ? {
                              sequenceChanged: sequenceOutdated,
                              tagsChanged: tagsOutdated,
                              additionalDataChanged: additionalDataOutdated,
                          }
                        : undefined,
            });
        }
    }

    private async handleFolderSettingsUpdate(
        collection: Collection<T>,
        oldFolderData: CollectionData<T>,
    ) {
        const folderPath = oldFolderData.item.getPath();

        // All data from folder settings files currently only affects the respective collection directory item.
        // So only the directory item needs to be updated on changes.
        const newCollectionData = await addOrReplaceItemInCollection({
            collection,
            path: folderPath,
            additionalDataProvider: this.additionalDataProvider,
        });
        if (!newCollectionData) {
            return;
        }

        const {
            details: { sequenceOutdated, tagsOutdated, additionalDataOutdated },
        } = isModifiedItemOutdated(
            oldFolderData,
            newCollectionData,
            this.additionalDataProvider,
        );

        this.handleOutboundNotification({
            collection,
            data: newCollectionData,
            updateType: FileChangeType.Modified,
            changedData: {
                sequenceChanged: sequenceOutdated,
                tagsChanged: tagsOutdated,
                additionalDataChanged: additionalDataOutdated,
            },
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
                    normalizePath(i.getPath()) == normalizePath(path) &&
                    type == updateType,
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
