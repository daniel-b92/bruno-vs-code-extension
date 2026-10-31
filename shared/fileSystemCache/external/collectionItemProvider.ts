import { CollectionRegistry } from "../internal/collectionRegistry";
import {
    addOrReplaceItemInCollection,
    replaceItemInCollection,
} from "../internal/addOrReplaceItemInCollection";
import { registerMissingCollectionsAndTheirItems } from "../internal/registerMissingCollectionsAndTheirItems";
import {
    normalizePath,
    CollectionWatcher,
    FileChangeType,
    BrunoFileType,
    Collection,
    CollectionFormat,
    CollectionData,
    isCollectionItemWithSequence,
    Logger,
    AdditionalCollectionDataProvider,
    getCollectionRootFilePath,
    FeatureToggles,
    getCollectionRootData,
    getItemType,
    NonBrunoSpecificItemType,
    NotificationData,
    ReadyOnlyCollection,
    ConflictingCollectionRootFiles,
    isFileRelevantForCollections,
} from "../..";
import { basename, dirname } from "path";
import { isModifiedItemOutdated } from "../internal/isModifiedItemOutdated";
import { Evt } from "evt";

export class CollectionItemProvider<T> {
    constructor(
        collectionWatcher: CollectionWatcher,
        private workspaceFolders: string[],
        private additionalDataProvider: AdditionalCollectionDataProvider<T>,
        private filePathsToIgnore: RegExp[],
        private featureToggles: FeatureToggles,
        private cacheRefreshNotifier?: Evt<void>,
        private logger?: Logger,
        private onConflictingCollectionRootFiles?: (
            conflicts: ConflictingCollectionRootFiles[],
        ) => void,
        private runInitialCacheLoad?: (
            load: () => Promise<void>,
        ) => Promise<void>,
    ) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = Evt.create<NotificationData<T>[]>();
        this.initialCacheLoadEmitter = Evt.create<void>();
        this.additionalContextRootsEmitter = Evt.create<void>();

        collectionWatcher.subscribeToUpdates(
            async ({ path, changeType: fileChangeType }) => {
                const registeredCollection =
                    this.getAncestorFullCollectionForPath(path);

                if (!registeredCollection) {
                    return;
                }

                if (
                    (registeredCollection.isRootDirectory(path) ||
                        this.doesPathMatchCollectionRootFile(
                            registeredCollection,
                            path,
                        )) &&
                    fileChangeType == FileChangeType.Deleted &&
                    !this.shouldPathBeIgnored(path)
                ) {
                    this.logger?.info(
                        `${this.commonPreMessageForLogging} Handling deletion of collection '${path}'.`,
                    );
                    this.handleCollectionDeletion(
                        registeredCollection.getRootDirectory(),
                    );
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
    private initialCacheLoadEmitter: Evt<void>;
    private additionalContextRootsEmitter: Evt<void>;
    private initialCacheLoad: Promise<void> | undefined = undefined;
    private hasInitialCacheLoadFinished = false;
    private notificationBatch: NotificationData<T>[] = [];
    private notificationSendEventTimer: NodeJS.Timeout | undefined = undefined;
    private readonly commonPreMessageForLogging = "[CollectionItemProvider]";

    public subscribeToUpdates(callback: (e: NotificationData<T>[]) => void) {
        this.itemUpdateEmitter.attach(this.itemUpdateEmitterContext, callback);
    }

    public subscribeToUpdatesWithOwnContext(
        callback: (e: NotificationData<T>[]) => void,
    ) {
        const context = Evt.newCtx();
        this.itemUpdateEmitter.attach(context, callback);
        return context;
    }

    /**
     * The callback is called once, as soon as the initial cache load has finished (immediately, if that already happened).
     * Subscribing does not trigger the initial cache load.
     */
    public subscribeToInitialCacheLoad(callback: () => void) {
        if (this.hasInitialCacheLoadFinished) {
            callback();
            return;
        }

        this.initialCacheLoadEmitter.attachOnce(
            this.itemUpdateEmitterContext,
            callback,
        );
    }

    /**
     * The callback is called whenever the additional context roots of an already registered collection change (e.g. due to an edit of the collection root file).
     * Other changes of the registered collections (e.g. a new collection) are only reported via `subscribeToUpdates`.
     */
    public subscribeToAdditionalContextRootChanges(callback: () => void) {
        this.additionalContextRootsEmitter.attach(
            this.itemUpdateEmitterContext,
            callback,
        );
    }

    /**
     * Whether opening or editing the given file requires the cache to be loaded.
     */
    public isFileRelevantForCollections(filePath: string) {
        return isFileRelevantForCollections(
            filePath,
            this.workspaceFolders,
            this.featureToggles,
        );
    }

    public getRegisteredCollections() {
        return this.collectionRegistry.getRegisteredCollections() as ReadyOnlyCollection<T>[];
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

    public getRegisteredItem(
        collection: ReadyOnlyCollection<T>,
        itemPath: string,
    ) {
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
            normalizePath(itemPath).startsWith(
                normalizePath(collection.getRootDirectory()),
            ),
        );
    }

    public getAdditionalContextRootContainingItem(itemPath: string) {
        for (const collection of this.getRegisteredCollections()) {
            const matchingContextRoot = findContextRootContainingItem(
                collection,
                itemPath,
            );

            if (matchingContextRoot !== undefined) {
                return { collection, matchingContextRoot };
            }
        }

        return undefined;
    }

    /** Unlike `getAdditionalContextRootContainingItem`, this returns all matching collections, as a context root can be shared by multiple collections. */
    public getCollectionsWithAdditionalContextRootContainingItem(
        itemPath: string,
    ) {
        return this.getRegisteredCollections().filter(
            (collection) =>
                findContextRootContainingItem(collection, itemPath) !==
                undefined,
        );
    }

    public getUniqueAdditionalContextRoots() {
        return this.getRegisteredCollections()
            .flatMap((collection) => collection.getAdditionalContextRoots())
            .filter((path, index, array) => array.indexOf(path) === index);
    }

    /**
     * Starts the initial cache load, if that did not happen yet. The synchronous getters only return data after this has finished.
     * Calling it again returns the same promise.
     */
    public ensureCacheIsLoaded() {
        this.initialCacheLoad ??= this.loadInitially().catch((e) => {
            // Allows retrying on the next call.
            this.initialCacheLoad = undefined;
            throw e;
        });

        return this.initialCacheLoad;
    }

    /**
     * Reloads the whole cache. If the cache has not been loaded yet, this counts as the initial cache load.
     */
    public async refreshCache() {
        if (!this.initialCacheLoad) {
            return this.ensureCacheIsLoaded();
        }

        // Avoids two interleaving file system scans.
        await this.initialCacheLoad;

        if (this.cacheRefreshNotifier) {
            this.cacheRefreshNotifier.post();
        }

        await this.loadCache();
    }

    public async reloadCollectionRootFolderItem(collectionRoot: string) {
        const collection =
            this.getAncestorFullCollectionForPath(collectionRoot);

        if (!collection || !collection.isRootDirectory(collectionRoot)) {
            this.logger?.warn(
                `${this.commonPreMessageForLogging} Reloading collection root item '${collectionRoot}' failed because no matching registered collection was found.`,
            );
            return;
        }

        const oldData = collection.getStoredDataForPath(collectionRoot);

        const newData = await addOrReplaceItemInCollection({
            collection,
            fileSystemData: collectionRoot,
            additionalDataProvider: this.additionalDataProvider,
        });

        if (oldData && newData) {
            const {
                details: {
                    sequenceOutdated,
                    tagsOutdated,
                    additionalDataOutdated,
                },
            } = isModifiedItemOutdated(
                oldData,
                newData,
                this.additionalDataProvider,
            );

            await this.handleOutboundNotification({
                collection,
                data: newData,
                updateType: FileChangeType.Modified,
                changedData: {
                    additionalDataChanged: additionalDataOutdated,
                    sequenceChanged: sequenceOutdated,
                    tagsChanged: tagsOutdated,
                },
            });
        }
    }

    public dispose() {
        if (this.notificationSendEventTimer) {
            clearTimeout(this.notificationSendEventTimer);
        }

        this.collectionRegistry.dispose();
        this.itemUpdateEmitterContext.done();
        this.notificationBatch.splice(0);
    }

    private async loadInitially() {
        if (this.runInitialCacheLoad) {
            await this.runInitialCacheLoad(() => this.loadCache());
        } else {
            await this.loadCache();
        }

        this.hasInitialCacheLoadFinished = true;
        this.initialCacheLoadEmitter.post();
    }

    private async loadCache() {
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
            this.workspaceFolders,
            this.filePathsToIgnore,
            this.additionalDataProvider,
            this.featureToggles,
            this.logger,
            this.onConflictingCollectionRootFiles,
        );

        const endTime = performance.now();
        this.logger?.info(
            `${this.commonPreMessageForLogging} Cache refresh duration: ${Math.round(
                endTime - startTime,
            )} ms`,
        );
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
        const collectionData = await addOrReplaceItemInCollection({
            collection: registeredCollection,
            fileSystemData: itemPath,
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
        collectionForItem: Collection<T>,
        collectionData: CollectionData<T>,
    ) {
        const { item: modifiedItem } = collectionData;
        const itemPath = modifiedItem.getPath();

        if (!modifiedItem.isFile()) {
            return;
        }

        if (this.doesPathMatchCollectionRootFile(collectionForItem, itemPath)) {
            const collectionRootData = await getCollectionRootData(
                collectionForItem.getRootDirectory(),
                collectionForItem.getFormat(),
            );

            if (collectionRootData) {
                const oldRoots = collectionForItem.getAdditionalContextRoots();
                const newRoots =
                    collectionRootData.additionalContextRoots ?? [];

                collectionForItem.setAdditionalContextRoots(newRoots);

                if (
                    oldRoots.length != newRoots.length ||
                    oldRoots.some((root, index) => root != newRoots[index])
                ) {
                    this.additionalContextRootsEmitter.post();
                }
            }

            // Changes to the additionalContextRoots are not relevant for the subscribers of the item updates. Therefore, no notifications
            // need to be sent for them.
            // In the yaml format, the collection root file is also the collection settings file, so it still needs to be handled below.
            if (collectionForItem.getFormat() == CollectionFormat.Bru) {
                return;
            }
        }

        if (
            await this.handleChangedItemType(collectionForItem, collectionData)
        ) {
            return;
        }

        if (
            modifiedItem.getItemType() == BrunoFileType.FolderSettingsFile ||
            modifiedItem.getItemType() == BrunoFileType.CollectionSettingsFile
        ) {
            const parentFolderData = collectionForItem.getStoredDataForPath(
                dirname(itemPath),
            );

            if (
                parentFolderData &&
                isCollectionItemWithSequence(parentFolderData.item)
            ) {
                await this.handleFolderSettingsUpdate(
                    collectionForItem,
                    parentFolderData,
                );
            }
        } else if (
            modifiedItem.getItemType() == BrunoFileType.EnvironmentFile ||
            modifiedItem.getItemType() == BrunoFileType.AppFile ||
            (isCollectionItemWithSequence(modifiedItem) &&
                modifiedItem.getItemType() == BrunoFileType.RequestFile)
        ) {
            const newData = await replaceItemInCollection({
                collection: collectionForItem,
                fileSystemData: itemPath,
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
                collection: collectionForItem,
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

    /**
     * The type of some files depends on their content (e.g. a file that was invalid or empty can become a valid request file).
     * If the type of such a file changed, the old item is replaced by a new one.
     *
     * @returns `true` if the type has changed and the item was replaced.
     */
    private async handleChangedItemType(
        collection: Collection<T>,
        oldData: CollectionData<T>,
    ) {
        const { item } = oldData;
        const oldType = item.getItemType();

        if (
            oldType != NonBrunoSpecificItemType.OtherFileType &&
            oldType != BrunoFileType.RequestFile &&
            oldType != BrunoFileType.AppFile
        ) {
            return false;
        }

        const newType = await getItemType(collection, item.getPath());

        if (newType === undefined || newType == oldType) {
            return false;
        }

        this.logger?.info(
            `${this.commonPreMessageForLogging} Type of item '${item.getPath()}' changed from '${oldType}' to '${newType}'.`,
        );

        collection.removeTestItemAndDescendants(item);
        await this.handleOutboundNotification({
            collection,
            data: oldData,
            updateType: FileChangeType.Deleted,
        });
        await this.handleItemCreation(collection, item.getPath());

        return true;
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
            fileSystemData: folderPath,
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

    private getAncestorFullCollectionForPath(itemPath: string) {
        return this.collectionRegistry
            .getRegisteredCollections()
            .find((collection) =>
                normalizePath(itemPath).startsWith(
                    normalizePath(collection.getRootDirectory()),
                ),
            );
    }

    private shouldPathBeIgnored(path: string) {
        return this.filePathsToIgnore.some((patternToIgnore) =>
            path.match(patternToIgnore),
        );
    }

    private doesPathMatchCollectionRootFile(
        collection: Collection<T>,
        path: string,
    ) {
        return (
            normalizePath(path) ==
            normalizePath(
                getCollectionRootFilePath(
                    collection.getRootDirectory(),
                    collection.getFormat(),
                ),
            )
        );
    }
}

function findContextRootContainingItem(
    collection: ReadyOnlyCollection<unknown>,
    itemPath: string,
) {
    return collection
        .getAdditionalContextRoots()
        .find((root) =>
            normalizePath(itemPath).startsWith(normalizePath(root)),
        );
}
