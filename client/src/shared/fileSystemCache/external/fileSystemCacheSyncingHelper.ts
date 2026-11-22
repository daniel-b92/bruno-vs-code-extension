import { Event } from "vscode";
import { dirname } from "path";
import { OutputChannelLogger } from "../../logging/outputChannelLogger";
import {
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../model/interfaces";
import {
    isCollectionItemWithSequence,
    parseSequenceFromFile,
} from "@global_shared";
import {
    ResultCode,
    waitForFilesFromFolderToBeInSync,
} from "../internal/waitForFilesFromFolderToBeInSync";

export class FileSystemCacheSyncingHelper {
    constructor(
        private itemProvider: TypedCollectionItemProvider,
        private logger?: OutputChannelLogger,
    ) {}

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
        const collection =
            this.itemProvider.getAncestorCollectionForPath(
                collectionRootFolder,
            );

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

        if (await this.isCachedFileInSync(collection, filePath)) {
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

        const filesToCheck = [
            {
                path: filePath,
                sequence: await parseSequenceFromFile(filePath),
            },
        ];

        if (shouldAbort) {
            addLogEntryForAbortion();
            return false;
        }

        const resultCode = await waitForFilesFromFolderToBeInSync(
            filesToCheck,
            dirname(filePath),
            {
                shouldAbort: () => shouldAbort,
                getSubscriptionForCacheUpdates: (callback) =>
                    this.itemProvider.subscribeToUpdatesWithOwnContext(
                        callback,
                    ),
            },
            timeoutInMillis,
            this.logger,
        );

        if (resultCode == ResultCode.WaitingCompleted) {
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

    private async isCachedFileInSync(
        collection: TypedCollection,
        filePath: string,
    ) {
        const cachedData = collection.getStoredDataForPath(filePath);

        return (
            cachedData != undefined &&
            isCollectionItemWithSequence(cachedData.item) &&
            (await parseSequenceFromFile(filePath)) ==
                cachedData.item.getSequence()
        );
    }
}
