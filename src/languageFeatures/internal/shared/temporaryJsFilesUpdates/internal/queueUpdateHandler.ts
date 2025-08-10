import { EventEmitter } from "vscode";
import {
    OutputChannelLogger,
    normalizeDirectoryPath,
} from "../../../../../shared";
import { TempJsUpdateRequest, TempJsUpdateType } from "./interfaces";

export class QueueUpdateHandler {
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
        requestsRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        await this.getLockForRequest(id, requestsRemovedFromQueueNotifier);

        const { index } = this.getRequestFromQueue(id);
        this.queue.splice(index, 1);

        this.removeLockForRequest(id);
        requestsRemovedFromQueueNotifier.fire([id]);
    }

    public getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }

    public getRequestFromQueue(requestId: string) {
        const matchingRequests = this.queue
            .map((request, index) => ({ request, index }))
            .filter(({ request: queued }) => requestId == queued.id);

        if (matchingRequests.length != 1) {
            throw new Error(
                `Could not find exactly one temp JS update request in queue for the given ID.
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
            } else if (!this.lockedBy && this.queue.length <= 1) {
                // ToDo: Ensure that the request that has waited the longest gets assigned the next
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
