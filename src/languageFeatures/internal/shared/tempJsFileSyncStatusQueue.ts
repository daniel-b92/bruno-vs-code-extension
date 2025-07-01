import { EventEmitter, TextDocument } from "vscode";
import { TemporaryJsFilesRegistry } from "./temporaryJsFilesRegistry";
import {
    Collection,
    OutputChannelLogger,
    parseBruFile,
    TextDocumentHelper,
} from "../../../shared";
import { createTemporaryJsFile } from "./codeBlocksUtils/createTemporaryJsFile";
import { waitForTempJsFileToBeInSync } from "./codeBlocksUtils/waitForTempJsFileToBeInSync";
import { getCodeBlocks } from "./codeBlocksUtils/getCodeBlocks";

interface QueuedSyncRequest {
    collection: Collection;
    bruFilePath: string;
    bruFileContent: string;
}

export class TempJsFileSyncStatusQueue {
    constructor(
        private tempJsFilesRegistry: TemporaryJsFilesRegistry,
        private logger?: OutputChannelLogger
    ) {
        this.isInSync = new EventEmitter<{
            request: QueuedSyncRequest;
            tempJsDocument?: TextDocument;
        }>();
        this.queue = [];
        this.activeRequest = undefined;
    }

    private isInSync: EventEmitter<{
        request: QueuedSyncRequest;
        tempJsDocument?: TextDocument;
    }>;
    private queue: QueuedSyncRequest[];
    private activeRequest: QueuedSyncRequest | undefined;

    public addToQueue(queuedSyncRequest: QueuedSyncRequest) {
        this.queue.push(queuedSyncRequest);

        if (this.queue.length == 1 && !this.activeRequest) {
            this.triggerSyncForOldestRequest();
        }

        return this.isInSync.event;
    }

    public removeItemFromQueue(toRemove: QueuedSyncRequest) {
        const oldestItemBeforeRemoval = this.getOldestItemFromQueue();

        const indexForRemoval = this.getIndexForRequestInQueue(toRemove);

        if (indexForRemoval >= 0) {
            this.queue.splice(indexForRemoval, 1);

            if (indexForRemoval == 0) {
                // If the oldest item is removed, no request is active anymore
                this.activeRequest = undefined;
            }
        } else {
            console.warn(
                `Item with path '${toRemove.bruFilePath}' to be removed from temp js sync queue not found in queue.`
            );
        }

        if (
            this.queue.length > 0 &&
            oldestItemBeforeRemoval &&
            this.getIndexForRequestInQueue(oldestItemBeforeRemoval) < 0
        ) {
            // If the oldest item in the queue is a different item than before we can trigger a sync for the oldest request
            this.triggerSyncForOldestRequest();
        }
    }

    private async triggerSyncForOldestRequest() {
        if (this.queue.length == 0) {
            this.logger?.warn(
                `Requested to trigger sync for oldest queued bru file request but no items were found in the queue.`
            );
            return;
        }
        const toSync = this.getOldestItemFromQueue() as QueuedSyncRequest;

        createTemporaryJsFile(
            toSync.collection.getRootDirectory(),
            this.tempJsFilesRegistry,
            toSync.bruFileContent,
            this.logger
        );

        const tempJsDocument = await waitForTempJsFileToBeInSync(
            this.tempJsFilesRegistry,
            toSync.collection,
            toSync.bruFileContent,
            getCodeBlocks(
                parseBruFile(new TextDocumentHelper(toSync.bruFileContent))
                    .blocks
            ),
            toSync.bruFilePath,
            this.logger
        );

        this.isInSync.fire({ request: toSync, tempJsDocument });
    }

    private getIndexForRequestInQueue(toFind: QueuedSyncRequest) {
        return this.queue.findIndex(
            ({
                collection: collectionRootDirectory,
                bruFileContent,
                bruFilePath,
            }) =>
                toFind.collection == collectionRootDirectory &&
                toFind.bruFileContent == bruFileContent &&
                toFind.bruFilePath == bruFilePath
        );
    }

    private getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }
}
