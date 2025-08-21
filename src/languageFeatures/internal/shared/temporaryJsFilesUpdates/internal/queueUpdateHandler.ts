import { EventEmitter } from "vscode";
import { OutputChannelLogger } from "../../../../../shared";
import { TempJsUpdateRequest, TempJsUpdateType } from "./interfaces";

export class QueueUpdateHandler {
    constructor(private logger?: OutputChannelLogger) {
        this.queue = [];
        this.lockedBy = undefined;
    }

    private queue: { request: TempJsUpdateRequest; id: string }[];
    private lockedBy: { requestId: string; time: Date } | undefined;
    private lockAvailableNotifier = new EventEmitter<void>();
    private requestsWaitingForLock: string[] = [];

    public async addToEndOfQueue(request: TempJsUpdateRequest, id: string) {
        await this.getLockForRequest(id);

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
        await this.getLockForRequest(id);

        const requestFromQueue = this.getRequestFromQueue(id);

        if (!requestFromQueue) {
            this.removeLockForRequest(id);
            return;
        }

        this.queue.splice(requestFromQueue.index, 1);

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
            this.logger?.warn(
                `Could not find exactly one temp JS update request in queue for the given ID.
                Found ${matchingRequests.length} queued items matching the given ID.`,
            );

            return undefined;
        }

        return matchingRequests[0];
    }

    public getLengthOfQueue() {
        return this.queue.length;
    }

    public async removeOutdatedRequestsFromQueue(
        newRequest: TempJsUpdateRequest,
        id: string,
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        const { update: newUpdate, filePath: pathForNewRequest } = newRequest;

        await this.getLockForRequest(id);

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
                        filePath: pathForQueuedRequest,
                        update: queuedUpdate,
                    },
                }) => {
                    if (pathForNewRequest != pathForQueuedRequest) {
                        return false;
                    }

                    return (
                        newUpdate.type != queuedUpdate.type ||
                        newUpdate.type == TempJsUpdateType.Deletion ||
                        (queuedUpdate.type == TempJsUpdateType.Creation &&
                            newUpdate.tempJsFileContent !=
                                queuedUpdate.tempJsFileContent)
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

    public resetWholeState(
        requestRemovedFromQueueNotifier: EventEmitter<string[]>,
    ) {
        const toRemoveFromQueue = this.queue.map(({ id }) => id);
        this.dispose();

        if (toRemoveFromQueue.length > 0) {
            requestRemovedFromQueueNotifier.fire(toRemoveFromQueue);
        }
    }

    public dispose() {
        this.lockAvailableNotifier.dispose();
        this.queue.splice(0);
        this.lockedBy = undefined;
    }

    private async getLockForRequest(requestId: string) {
        if (this.requestsWaitingForLock.includes(requestId)) {
            throw new Error(
                `Request that just started waiting for lock is already in list of waiting requests.`,
            );
        }

        this.requestsWaitingForLock.push(requestId);

        return await new Promise<void>((resolve) => {
            this.lockAvailableNotifier.event(() => {
                const requestWithNextTurn =
                    this.getRequestWithMinPositionInQueue(
                        this.requestsWaitingForLock,
                    );

                if (
                    !requestWithNextTurn ||
                    requestWithNextTurn.id == requestId
                ) {
                    resolve();
                    this.removeRequestFromWaitingListForLock(requestId);
                    return;
                }
            });

            if (this.lockedBy && this.lockedBy.requestId == requestId) {
                resolve();
                this.removeRequestFromWaitingListForLock(requestId);
                return;
            }

            const requestWithMinPositionInQueue =
                this.getRequestWithMinPositionInQueue(
                    this.requestsWaitingForLock,
                );

            if (
                !this.lockedBy &&
                (!requestWithMinPositionInQueue ||
                    requestWithMinPositionInQueue.id == requestId)
            ) {
                this.lockedBy = { requestId, time: new Date() };
                resolve();
                this.removeRequestFromWaitingListForLock(requestId);
                return;
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
            this.lockAvailableNotifier.fire();
        }
    }

    private removeRequestFromWaitingListForLock(requestId: string) {
        const indexToRemove = this.requestsWaitingForLock.findIndex(
            (idFromList) => idFromList == requestId,
        );

        if (indexToRemove >= 0) {
            this.requestsWaitingForLock.splice(indexToRemove, 1);
        }
    }

    private getRequestWithMinPositionInQueue(requestIds: string[]) {
        if (this.queue.length == 0 || requestIds.length == 0) {
            return undefined;
        }

        const requestsInBothLists = this.queue
            .map(({ id }, index) => ({ index, id }))
            .filter(({ id }) => requestIds.includes(id));

        return requestsInBothLists.length > 0
            ? requestsInBothLists.sort(
                  ({ index: index1 }, { index: index2 }) => index1 - index2,
              )[0]
            : undefined;
    }
}
