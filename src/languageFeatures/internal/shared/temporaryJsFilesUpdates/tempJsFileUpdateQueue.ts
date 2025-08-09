import { TempJsUpdateRequest, TempJsUpdateType } from "./internal/interfaces";
import { TemporaryJsFilesRegistry } from "./internal/temporaryJsFilesRegistry";
import {
    checkIfPathExistsAsync,
    getTemporaryJsFileName,
    normalizeDirectoryPath,
    OutputChannelLogger,
} from "../../../../shared";
import { createTemporaryJsFile } from "./internal/createTemporaryJsFile";
import { deleteTemporaryJsFileForCollection } from "./internal/deleteTemporaryJsFile";
import { CancellationToken, EventEmitter } from "vscode";
import { setTimeout } from "timers/promises";

export class TempJsFileUpdateQueue {
    constructor(
        private registry: TemporaryJsFilesRegistry,
        private logger?: OutputChannelLogger,
    ) {
        this.activeUpdate = undefined;
        this.latestRequestBruFileContent = undefined;
        this.queueUpdater = new QueueUpdateHandler();

        this.requestHasBeenRemovedFromQueueNotifier.event(
            (removedRequestIds) => {
                if (
                    this.activeUpdate &&
                    removedRequestIds.includes(this.activeUpdate.id)
                ) {
                    this.activeUpdate = undefined;

                    const newOldestRequest =
                        this.queueUpdater.getOldestItemFromQueue();

                    if (newOldestRequest) {
                        this.requestCanBeRunNotifier.fire(newOldestRequest.id);
                    }
                }
            },
        );
    }

    private queueUpdater: QueueUpdateHandler;
    private activeUpdate:
        | { request: TempJsUpdateRequest; id: string }
        | undefined;
    private requestCanBeRunNotifier = new EventEmitter<string>();
    private latestRequestBruFileContent: string | undefined;
    private requestHasBeenRemovedFromQueueNotifier = new EventEmitter<
        string[]
    >();

    public async addToQueue(updateRequest: TempJsUpdateRequest) {
        const id = this.getIdForRequest(updateRequest);

        const { cancellationToken: token } = updateRequest;

        await this.queueUpdater.removeOutdatedRequestsFromQueue(
            updateRequest,
            id,
            this.requestHasBeenRemovedFromQueueNotifier,
        );

        if (token && token.isCancellationRequested) {
            return false;
        }

        await this.queueUpdater.addToEndOfQueue(
            updateRequest,
            id,
            this.requestHasBeenRemovedFromQueueNotifier,
        );

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(id);
            return false;
        }

        if (this.queueUpdater.getLengthOfQueue() <= 1 && !this.activeUpdate) {
            await this.triggerUpdate(id, token);
            return true;
        }

        const shouldRun = await this.waitForRequestToBeAbleToRunOrBeCancelled(
            id,
            token,
        );

        if (shouldRun) {
            const wasTriggered = await this.triggerUpdate(id, token);
            return wasTriggered;
        } else {
            return false;
        }
    }

    public dispose() {
        this.requestCanBeRunNotifier.dispose();
        this.requestHasBeenRemovedFromQueueNotifier.dispose();
        this.registry.dispose();
        this.queueUpdater.dispose();
        this.activeUpdate = undefined;
    }

    private async waitForRequestToBeAbleToRunOrBeCancelled(
        requestId: string,
        token?: CancellationToken,
    ) {
        return await new Promise<boolean>((resolve) => {
            if (token) {
                token.onCancellationRequested(() => {
                    this.removeFromQueue(requestId).then(() => {
                        resolve(false);
                    });
                });
            }

            this.requestHasBeenRemovedFromQueueNotifier.event(
                (removedRequestIds) => {
                    if (removedRequestIds.includes(requestId)) {
                        resolve(false);
                    }
                },
            );

            this.requestCanBeRunNotifier.event((id) => {
                if (token && token.isCancellationRequested) {
                    resolve(false);
                }

                if (id == requestId) {
                    resolve(true);
                }
            });
        });
    }

    private async triggerUpdate(requestId: string, token?: CancellationToken) {
        const { request } = this.queueUpdater.getRequestFromQueue(requestId);

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(requestId);
            return false;
        }

        this.activeUpdate = request;

        const {
            request: { collectionRootFolder, update },
        } = request;

        if (
            update.type == TempJsUpdateType.Creation &&
            update.bruFileContent != this.latestRequestBruFileContent
        ) {
            const wasSuccessful = await createTemporaryJsFile(
                collectionRootFolder,
                this.registry,
                update.bruFileContent,
                token,
                this.logger,
            );

            if (wasSuccessful) {
                this.latestRequestBruFileContent = update.bruFileContent;
            }
            await this.cleanupAfterUpdate(requestId);

            return wasSuccessful;
        } else if (
            update.type == TempJsUpdateType.Deletion &&
            (await checkIfPathExistsAsync(
                getTemporaryJsFileName(collectionRootFolder),
            ))
        ) {
            const deletionIdentifier = 0;
            const cancellationIdentifier = 1;
            const otherCreationRequestIdentifier = 2;

            const deletionPromise = setTimeout(
                8_000,
                deletionIdentifier,
            ); /* Sometimes, the deletions seem to block other important functions from the extension host.
            To avoid this, we add some waiting time before actually executing the deletion.*/

            const cancellationPromise = new Promise<number>((resolve) => {
                if (token) {
                    token.onCancellationRequested(() => {
                        resolve(cancellationIdentifier);
                    });
                }
            });

            const otherCreationRequestPromise = new Promise<number>(
                (resolve) => {
                    this.queueUpdater
                        .waitForRequestsToBeAddedToQueue()
                        .then((newRequests) => {
                            if (
                                newRequests.length > 0 &&
                                newRequests.some(
                                    ({
                                        id,
                                        request: {
                                            collectionRootFolder:
                                                newRequestCollection,
                                            update: newUpdate,
                                        },
                                    }) =>
                                        id != requestId &&
                                        newRequestCollection ==
                                            collectionRootFolder &&
                                        newUpdate.type ==
                                            TempJsUpdateType.Creation,
                                )
                            ) {
                                this.logger?.debug(
                                    `Removing temp js file deletion request from queue since newer request exists for file creation already.`,
                                );

                                resolve(otherCreationRequestIdentifier);
                            }
                        });
                },
            );

            const fulfilledCondition = await Promise.race([
                deletionPromise,
                cancellationPromise,
                otherCreationRequestPromise,
            ]);

            if (fulfilledCondition == deletionIdentifier) {
                await deleteTemporaryJsFileForCollection(
                    this.registry,
                    collectionRootFolder,
                    this.logger,
                );

                this.latestRequestBruFileContent = undefined;

                if (token && token.isCancellationRequested) {
                    this.logger?.debug(
                        `Cancellation requested for temp JS update with type '${request.request.update.type}' after triggering workspace edit. Could not be aborted anymore.`,
                    );
                }
            }
        }

        await this.cleanupAfterUpdate(requestId);

        return true;
    }

    private async cleanupAfterUpdate(requestId: string) {
        this.activeUpdate = undefined;
        await this.removeFromQueue(requestId);
    }

    private async removeFromQueue(requestId: string) {
        if (this.activeUpdate && this.activeUpdate.id == requestId) {
            this.logger?.warn(
                `Will remove temp JS update request from queue that is currently marked as active.`,
            );

            this.activeUpdate = undefined;
        }

        await this.queueUpdater.removeFromQueue(
            requestId,
            this.requestHasBeenRemovedFromQueueNotifier,
        );

        const newOldestItem = this.queueUpdater.getOldestItemFromQueue();

        if (newOldestItem) {
            this.requestCanBeRunNotifier.fire(newOldestItem.id);
        }
    }

    private getIdForRequest(request: TempJsUpdateRequest) {
        const { collectionRootFolder, update } = request;
        return `${collectionRootFolder}-${update.type == TempJsUpdateType.Creation ? `${update.bruFileContent}` : update.type}-${new Date().getTime()}`;
    }
}

class QueueUpdateHandler {
    constructor(private logger?: OutputChannelLogger) {
        this.queue = [];
        this.lockedBy = undefined;
    }

    private queue: { request: TempJsUpdateRequest; id: string }[];
    private lockedBy: { requestId: string; time: Date } | undefined;
    private canObtainLockNotifier = new EventEmitter<string>();

    public async addToEndOfQueue(
        request: TempJsUpdateRequest,
        id: string,
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        await this.getLockForRequest(id, requestRemovedFromQueueNotifier);

        this.queue.push({ request, id });

        if (this.queue.length > 2) {
            this.logger?.trace(
                `More than 2 temp JS update requests exist. Current queue length: ${this.queue.length}`,
            );
        }

        this.removeLockForRequest(id);
    }

    public async removeFromQueue(
        id: string,
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        await this.getLockForRequest(id, requestRemovedFromQueueNotifier);

        const { index } = this.getRequestFromQueue(id);
        this.queue.splice(index, 1);

        this.removeLockForRequest(id);
        requestRemovedFromQueueNotifier.fire([id]);
    }

    public getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }

    public waitForRequestsToBeAddedToQueue() {
        const initialRequestIds = this.queue.map(({ id }) => id);

        return new Promise<{ request: TempJsUpdateRequest; id: string }[]>(
            (resolve) => {
                if (
                    this.queue.some(({ id }) => !initialRequestIds.includes(id))
                ) {
                    resolve(
                        this.queue.filter(
                            ({ id }) => !initialRequestIds.includes(id),
                        ),
                    );
                }
            },
        );
    }

    public getRequestFromQueue(requestId: string) {
        const matchingRequests = this.queue
            .map((request, index) => ({ request, index }))
            .filter(({ request: queued }) => requestId == queued.id);

        if (matchingRequests.length != 1) {
            throw new Error(
                `Could not find exactly one temp JS update request in queue for ID '${requestId}'.
                Found ${matchingRequests.length} queued items matching the given ID.`,
            );
        }

        return matchingRequests[0];
    }

    public getLengthOfQueue() {
        return this.queue.length;
    }

    public async removeOutdatedRequestsFromQueue(
        latestRequest: TempJsUpdateRequest,
        id: string,
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        const {
            update: latestUpdate,
            collectionRootFolder: collectionForLatestRequest,
        } = latestRequest;

        await this.getLockForRequest(id, requestRemovedFromQueueNotifier);

        if (this.queue.length <= 1) {
            this.removeLockForRequest(id);
            return;
        }

        // Skip the very oldest request because it is most likely either actively being worked on or will be very soon
        // (to avoid race conditions).
        const redundantRequests = this.queue
            .slice(1)
            .map(({ id, request }, oneBasedIndex) => ({
                id,
                request,
                index: oneBasedIndex + 1,
            }))
            .filter(
                ({
                    request: {
                        collectionRootFolder: collectionForQueuedRequest,
                        update: queuedUpdate,
                    },
                }) => {
                    if (
                        normalizeDirectoryPath(collectionForLatestRequest) !=
                        normalizeDirectoryPath(collectionForQueuedRequest)
                    ) {
                        return false;
                    }

                    return (
                        latestUpdate.type != queuedUpdate.type ||
                        latestUpdate.type == TempJsUpdateType.Deletion ||
                        (queuedUpdate.type == TempJsUpdateType.Creation &&
                            latestUpdate.bruFileContent !=
                                queuedUpdate.bruFileContent)
                    );
                },
            );

        redundantRequests.forEach(({ index }) => {
            this.queue.splice(index, 1);
        });

        this.removeLockForRequest(id);

        requestRemovedFromQueueNotifier.fire(
            redundantRequests.map(({ id }) => id),
        );
    }

    public dispose() {
        this.queue.splice(0);
        this.lockedBy = undefined;
        this.canObtainLockNotifier.dispose();
    }

    private async getLockForRequest(
        requestId: string,
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        return await new Promise<void>((resolve) => {
            this.canObtainLockNotifier.event((chosenId) => {
                if (requestId == chosenId) {
                    resolve();
                }
            });

            if (this.lockedBy && this.lockedBy.requestId == requestId) {
                resolve();
            } else if (
                !this.lockedBy &&
                (this.queue.length == 0 ||
                    (this.queue.length == 1 && this.queue[0].id == requestId))
            ) {
                this.lockedBy = { requestId, time: new Date() };
                resolve();
            }

            const maxLockingTimeInMs = 30_000;

            if (
                this.lockedBy &&
                this.lockedBy.requestId != requestId &&
                new Date().getTime() - this.lockedBy.time.getTime() >
                    maxLockingTimeInMs
            ) {
                this.logger?.warn(
                    `Request that holds the lock for updating temp js files seems to be stuck. Will forcefully remove the lock and delete the request from the queue.`,
                );

                const toRemoveFromQueue = this.lockedBy.requestId;

                // Usually,the lock property should not be set explicitly and instead the request should wait until it's notified that it can obtian the lock.
                // However, for resolving this stalemate situation, it has to be set explicitly.
                this.lockedBy = { requestId, time: new Date() };

                this.removeFromQueue(
                    toRemoveFromQueue,
                    requestRemovedFromQueueNotifier,
                ).then(() => {
                    this.removeLockForRequest(requestId);
                    resolve();
                });
            }
        });
    }

    private removeLockForRequest(requestId: string) {
        if (this.lockedBy && this.lockedBy.requestId != requestId) {
            this.logger?.warn(
                `Requested to remove lock for temp JS update request although it was locked by a different request.`,
            );

            return;
        }

        this.lockedBy = undefined;

        if (this.queue.length > 0) {
            this.canObtainLockNotifier.fire(this.queue[0].id);
        }
    }
}
