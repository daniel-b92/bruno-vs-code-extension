import { MultiFileOperationWithStatus } from "../../fileSystem/interfaces";
import { Disposable, Event, EventEmitter } from "vscode";
import { OutputChannelLogger } from "../../logging/outputChannelLogger";
import {
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../model/interfaces";
import {
    isCollectionItemWithSequence,
    normalizeDirectoryPath,
    parseSequenceFromMetaBlock,
} from "@global_shared";
import { dirname } from "path";
import { determineFilesToCheckWhetherInSync } from "../internal/determineFilesToCheckWhetherInSync";
import {
    ResultCode,
    waitForFilesFromFolderToBeInSync,
} from "../internal/waitForFilesFromFolderToBeInSync";

export class FileSystemCacheSyncingHelper {
    constructor(
        private itemProvider: TypedCollectionItemProvider,
        multiFileOperationSubscription: Event<MultiFileOperationWithStatus>,
        private logger?: OutputChannelLogger,
    ) {
        this.multiFileOperationFinishedNotifier = new EventEmitter<string>();

        this.disposables.push(
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

    private disposables: Disposable[] = [];
    private multiFileOperationFinishedNotifier: EventEmitter<string>;
    private latestMultiFileOperation: {
        folderPath: string | undefined;
        completionDate: Date | undefined;
    } = { folderPath: undefined, completionDate: undefined };
    private readonly commonPreMessageForLogging =
        "[FileSystemCacheSyncingHelper]";

    public async waitForFileToBeRegisteredInCache(
        collectionRootFolder: string,
        filePath: string,
        shouldAbortEvent?: Event<void>,
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
            return this.itemProvider
                .getRegisteredCollections()
                .find(
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
                    this.itemProvider.getRegisteredItem(collection, path),
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
                getSubscriptionForCacheUpdates: () =>
                    this.itemProvider.subscribeToUpdates,
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

    public dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
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

    private async isCachedFileInSync(
        collection: TypedCollection,
        filePath: string,
    ) {
        const cachedData = collection.getStoredDataForPath(filePath);

        return (
            cachedData != undefined &&
            isCollectionItemWithSequence(cachedData.item) &&
            (await parseSequenceFromMetaBlock(filePath)) ==
                cachedData.item.getSequence()
        );
    }
}
