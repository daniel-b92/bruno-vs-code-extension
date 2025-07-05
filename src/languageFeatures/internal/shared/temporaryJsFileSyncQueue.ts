import { EventEmitter, Uri, workspace } from "vscode";
import { TemporaryJsFilesRegistry } from "./temporaryJsFilesRegistry";
import {
    Block,
    Collection,
    getTemporaryJsFileName,
    OutputChannelLogger,
    parseBruFile,
    TextDocumentHelper,
} from "../../../shared";
import { createTemporaryJsFile } from "./codeBlocksUtils/createTemporaryJsFile";
import { waitForTempJsFileToBeInSync } from "./codeBlocksUtils/waitForTempJsFileToBeInSync";
import { getCodeBlocks } from "./codeBlocksUtils/getCodeBlocks";
import { isTempJsFileInSync } from "./codeBlocksUtils/isTempJsFileInSync";

interface QueuedSyncRequest {
    collection: Collection;
    bruFilePath: string;
    bruFileContent: string;
    bruFileCodeBlocks: Block[];
}

export class TemporaryJsFileSyncQueue {
    constructor(
        private tempJsFilesRegistry: TemporaryJsFilesRegistry,
        private logger?: OutputChannelLogger
    ) {
        this.canTriggerSync = new EventEmitter<QueuedSyncRequest>();
        this.queue = [];
        this.activeRequest = undefined;
    }

    private canTriggerSync: EventEmitter<QueuedSyncRequest>;
    private queue: QueuedSyncRequest[];
    private activeRequest: QueuedSyncRequest | undefined;

    public dispose() {
        this.canTriggerSync.dispose();
        this.queue.splice(0);
    }

    public async addToQueue(queuedSyncRequest: QueuedSyncRequest) {
        this.queue.push(queuedSyncRequest);

        if (this.queue.length == 1 && !this.activeRequest) {
            return await this.triggerSyncForOldestRequest();
        } else {
            await this.waitForTurn(queuedSyncRequest);
            return await this.triggerSyncForOldestRequest();
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
        this.activeRequest = toSync;

        const initialTempJsDoc = await workspace.openTextDocument(
            Uri.file(
                getTemporaryJsFileName(toSync.collection.getRootDirectory())
            )
        );

        if (
            isTempJsFileInSync(
                initialTempJsDoc.getText(),
                toSync.bruFileCodeBlocks
            )
        ) {
            this.logger?.debug(
                `Temporary Js file already in sync for request for bru file '${toSync.bruFilePath}'`
            );
            this.removeItemFromQueue(toSync);
            return initialTempJsDoc;
        }

        await createTemporaryJsFile(
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

        this.removeItemFromQueue(toSync);

        return tempJsDocument;
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
            this.logger?.warn(
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

    private async waitForTurn(request: QueuedSyncRequest) {
        return new Promise<void>((resolve) => {
            const oldestItemInQueue = this.getOldestItemFromQueue();

            if (
                !oldestItemInQueue ||
                this.getIndexForRequestInQueue(request) ==
                    this.getIndexForRequestInQueue(oldestItemInQueue)
            ) {
                resolve();
            }
        });
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
