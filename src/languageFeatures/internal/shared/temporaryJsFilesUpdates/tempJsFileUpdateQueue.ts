import { TempJsUpdateRequest, TempJsUpdateType } from "./internal/interfaces";
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
import { QueueUpdateHandler } from "./internal/queueUpdateHandler";

export class TempJsFileUpdateQueue {
    constructor(private logger?: OutputChannelLogger) {
        this.activeUpdate = undefined;
        this.latestRequestBruFileContent = undefined;
        this.queueUpdater = new QueueUpdateHandler(logger);

        this.requestRemovedFromQueueNotifier.event((removedRequestIds) => {
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
        });
    }

    private queueUpdater: QueueUpdateHandler;
    private activeUpdate:
        | { request: TempJsUpdateRequest; id: string }
        | undefined;
    private requestCanBeRunNotifier = new EventEmitter<string>();
    private latestRequestBruFileContent: string | undefined;
    private requestRemovedFromQueueNotifier = new EventEmitter<string[]>();
    private requestAddedToQueueNotifier = new EventEmitter<{
        request: TempJsUpdateRequest;
        id: string;
    }>();

    /**
     *
     * @param updateRequest The request for the update of the temporary js file.
     * @returns {boolean} A value indicating whether the temp JS file has been updated as requested.
     * This may e.g. not be the case, if the request has been aborted or if the request is outdated because a newer request for the same file has been issued in the meantime.
     */
    public async addToQueue(
        updateRequest: TempJsUpdateRequest,
    ): Promise<boolean> {
        const timeoutInMs = 15_000;

        try {
            const timeoutIdentifier = 0;
            const timeoutPromise = setTimeout(timeoutInMs, timeoutIdentifier);
            const addToQueuePromise = this.tryToAddToQueue(updateRequest);

            const fulfilledCondition = await Promise.race([
                timeoutPromise,
                addToQueuePromise,
            ]);

            if (fulfilledCondition === timeoutIdentifier) {
                throw new Error(
                    `Update request for temp js file seems to be stuck. The timeout has been reached.`,
                );
            }

            return fulfilledCondition as boolean;
        } catch (err) {
            this.logger?.error(
                `An internal error occured while trying to update temp js files for language features: '${(err as { message: string }).message}'. Will restart whole queue for updates.`,
            );

            this.resetWholeState();
            return false;
        }
    }

    public dispose() {
        this.requestCanBeRunNotifier.dispose();
        this.requestRemovedFromQueueNotifier.dispose();
        this.requestAddedToQueueNotifier.dispose();
        this.activeUpdate = undefined;
        this.queueUpdater.dispose();
    }

    private resetWholeState() {
        this.queueUpdater.resetWholeState(this.requestRemovedFromQueueNotifier);
        this.queueUpdater = new QueueUpdateHandler(this.logger);
        this.activeUpdate = undefined;
        this.latestRequestBruFileContent = undefined;
    }

    private async tryToAddToQueue(updateRequest: TempJsUpdateRequest) {
        const id = this.getIdForRequest(updateRequest);
        this.requestAddedToQueueNotifier.fire({
            request: updateRequest,
            id,
        });

        const { cancellationToken: token } = updateRequest;

        await this.queueUpdater.removeOutdatedRequestsFromQueue(
            updateRequest,
            id,
            this.requestRemovedFromQueueNotifier,
        );

        if (token && token.isCancellationRequested) {
            return false;
        }

        await this.queueUpdater.addToEndOfQueue(updateRequest, id);

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(id);
            return false;
        }

        if (this.queueUpdater.getLengthOfQueue() <= 1 && !this.activeUpdate) {
            // If no other requests are queued, we can skip waiting for the notification that the new request can be triggered.
            const result = await this.triggerUpdate(updateRequest, id, token);
            return result;
        }

        const shouldRun = await this.waitForRequestToBeAbleToRunOrBeCancelled(
            id,
            token,
        );

        return shouldRun
            ? await this.triggerUpdate(updateRequest, id, token)
            : false;
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
                        return;
                    });
                });
            }

            this.requestRemovedFromQueueNotifier.event((removedRequestIds) => {
                if (removedRequestIds.includes(requestId)) {
                    resolve(false);
                    return;
                }
            });

            this.requestCanBeRunNotifier.event((id) => {
                if (token && token.isCancellationRequested) {
                    resolve(false);
                    return;
                }

                if (id == requestId) {
                    resolve(true);
                    return;
                }
            });
        });
    }

    private async triggerUpdate(
        request: TempJsUpdateRequest,
        id: string,
        token?: CancellationToken,
    ) {
        let result = false;

        if (
            request.update.type == TempJsUpdateType.Creation &&
            request.update.bruFileContent != this.latestRequestBruFileContent
        ) {
            result = await this.triggerCreationUpdate(id, token);
        } else if (
            request.update.type == TempJsUpdateType.Deletion &&
            (await checkIfPathExistsAsync(
                getTemporaryJsFileName(request.collectionRootFolder),
            ))
        ) {
            result = await this.triggerDeletionUpdate(id, token);
        } else {
            // Case where temp js file should already be up to date.
            result = true;
        }

        await this.cleanupAfterUpdate(id);

        return result;
    }

    private async triggerCreationUpdate(
        requestId: string,
        token?: CancellationToken,
    ) {
        const { request } = this.queueUpdater.getRequestFromQueue(requestId);

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(requestId);
            return false;
        }

        this.activeUpdate = request;

        const {
            request: { collectionRootFolder, update },
        } = request;

        if (update.type != TempJsUpdateType.Creation) {
            throw new Error(
                "Cannot handle temp js deletion update in creation function.",
            );
        }

        const wasSuccessful = await createTemporaryJsFile(
            collectionRootFolder,
            update.bruFileContent,
            token,
            this.logger,
        );

        if (wasSuccessful) {
            this.latestRequestBruFileContent = update.bruFileContent;
        }

        return wasSuccessful;
    }

    private async triggerDeletionUpdate(
        requestId: string,
        token?: CancellationToken,
    ) {
        const { request } = this.queueUpdater.getRequestFromQueue(requestId);

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(requestId);
            return false;
        }

        this.activeUpdate = request;

        const {
            request: { collectionRootFolder },
        } = request;

        if (
            await checkIfPathExistsAsync(
                getTemporaryJsFileName(collectionRootFolder),
            )
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
                    this.waitForRequestToBeAddedToQueue().then((newRequest) => {
                        const {
                            id: newId,
                            request: {
                                collectionRootFolder: newCollectionRoot,
                            },
                        } = newRequest;

                        if (
                            newId != requestId &&
                            normalizeDirectoryPath(newCollectionRoot) ==
                                normalizeDirectoryPath(collectionRootFolder)
                        ) {
                            this.logger?.debug(
                                `Removing temp js file deletion request from queue since newer request exists for same file already.`,
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

        return true;
    }

    private waitForRequestToBeAddedToQueue() {
        return new Promise<{ request: TempJsUpdateRequest; id: string }>(
            (resolve) => {
                this.requestAddedToQueueNotifier.event((addedToQueue) => {
                    resolve(addedToQueue);
                });
            },
        );
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
            this.requestRemovedFromQueueNotifier,
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
