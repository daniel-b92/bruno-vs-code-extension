import { TempJsUpdateRequest, TempJsUpdateType } from "../internal/interfaces";
import {
    checkIfPathExistsAsync,
    everyAsync,
    OutputChannelLogger,
} from "../../../../../shared";
import { createTemporaryJsFile } from "../internal/createTemporaryJsFile";
import { deleteTemporaryJsFiles } from "../internal/deleteTemporaryJsFile";
import {
    CancellationToken,
    EventEmitter,
    Uri,
    Event as VsCodeEvent,
} from "vscode";
import { setTimeout } from "timers/promises";
import { QueueUpdateHandler } from "../internal/queueUpdateHandler";
import { basename, dirname } from "path";

export class TempJsFileUpdateQueue {
    constructor(
        private testRunStartedEvent: VsCodeEvent<Uri>,
        private logger?: OutputChannelLogger,
    ) {
        this.activeUpdate = undefined;
        this.latestRequestTempJsFileContent = undefined;
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
    private latestRequestTempJsFileContent: string | undefined;
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
            if (
                Object.keys(err as object).includes("code") &&
                (err as { code: string }).code == "ABORT_ERR"
            ) {
                this.logger?.warn(
                    "Received abortion error that was thrown during temp js file creation. Will reset whole queuing state, in order to clean up the queue.",
                );

                this.resetWholeState();
                // If a temp js file creation operation is aborted externally, an error is thrown.
                return false;
            }

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
        this.latestRequestTempJsFileContent = undefined;
    }

    private async tryToAddToQueue(updateRequest: TempJsUpdateRequest) {
        const id = this.getIdForRequest(updateRequest);

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

        this.requestAddedToQueueNotifier.fire({
            request: updateRequest,
            id,
        });

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
            request.update.tempJsFileContent !=
                this.latestRequestTempJsFileContent
        ) {
            result = await this.triggerCreationUpdate(id, token);
        } else if (
            request.update.type == TempJsUpdateType.Deletion &&
            (await everyAsync(
                request.update.filePaths,
                async (path) => await checkIfPathExistsAsync(path),
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
        const requestFromQueue =
            this.queueUpdater.getRequestFromQueue(requestId);

        if (!requestFromQueue) {
            throw new Error(
                `Could not find temp JS creation request in queue for the given ID.`,
            );
        }

        const { request } = requestFromQueue;

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(requestId);
            return false;
        }

        this.activeUpdate = request;

        if (request.request.update.type != TempJsUpdateType.Creation) {
            throw new Error(
                "Cannot handle temp js deletion update in creation function.",
            );
        }

        const {
            request: {
                update: { filePath: tempJsFilePath, tempJsFileContent },
            },
        } = request;

        const wasSuccessful = await createTemporaryJsFile(
            tempJsFilePath,
            tempJsFileContent,
            token,
            this.logger,
        );

        if (wasSuccessful) {
            this.latestRequestTempJsFileContent = tempJsFileContent;
        }

        return wasSuccessful;
    }

    private async triggerDeletionUpdate(
        requestId: string,
        token?: CancellationToken,
    ) {
        const requestFromQueue =
            this.queueUpdater.getRequestFromQueue(requestId);

        if (!requestFromQueue) {
            return false;
        }

        const { request } = requestFromQueue;

        if (token && token.isCancellationRequested) {
            await this.removeFromQueue(requestId);
            return false;
        }

        this.activeUpdate = request;

        if (request.request.update.type != TempJsUpdateType.Deletion) {
            throw new Error(
                "Cannot handle temp js creation update in deletion function.",
            );
        }

        const {
            request: {
                update: { filePaths },
            },
        } = request;

        if (
            await everyAsync(
                filePaths,
                async (path) => await checkIfPathExistsAsync(path),
            )
        ) {
            const deletionIdentifier = 0;
            const externalCancellationIdentifier = 1;
            const otherRequestAddedIdentifier = 2;
            const internalCancellationIdentifier = 3;

            const deletionPromise = setTimeout(
                5_000,
                deletionIdentifier,
            ); /* Sometimes, the deletions seem to block other important functions from the extension host.
            To avoid this, we add some waiting time before actually executing the deletion.*/

            const externalCancellationPromise = new Promise<number>(
                (resolve) => {
                    if (token) {
                        token.onCancellationRequested(() => {
                            resolve(externalCancellationIdentifier);
                        });
                    }
                },
            );

            const internalCancellationPromise = new Promise<number>(
                (resolve) => {
                    // Deleting a file while the Bruno CLI is just starting to run can result in an exception.
                    // Since deletion requests are not so important, just cancel the request.
                    this.testRunStartedEvent(() => {
                        resolve(internalCancellationIdentifier);
                    });
                },
            );

            const otherRequestAddedPromise = new Promise<number>((resolve) => {
                this.waitForRequestToBeAddedToQueue().then((newRequest) => {
                    const { id: newId } = newRequest;

                    // Avoid blocking other requests that are are added to the end of the queue (there's currently no way for other requests to skip ahead of this one).
                    // Deletion requests are by far not as important as creation requests, since they are only meant to clean up a little in the background.
                    if (newId != requestId) {
                        this.logger?.debug(
                            `Removing temp js file deletion request for folders ${JSON.stringify(
                                filePaths.map((path) =>
                                    basename(dirname(path)),
                                ),
                                null,
                                2,
                            )} from queue since newer request exists for another file already.`,
                        );

                        resolve(otherRequestAddedIdentifier);
                    }
                });
            });

            const fulfilledCondition = await Promise.race([
                deletionPromise,
                externalCancellationPromise,
                otherRequestAddedPromise,
                internalCancellationPromise,
            ]);

            if (fulfilledCondition == deletionIdentifier) {
                await deleteTemporaryJsFiles(filePaths, this.logger);

                this.latestRequestTempJsFileContent = undefined;

                if (token && token.isCancellationRequested) {
                    this.logger?.debug(
                        `Cancellation requested for temp JS update with type '${request.request.update.type}' after triggering workspace edit. Could not be aborted anymore.`,
                    );
                }
            } else if (fulfilledCondition == externalCancellationIdentifier) {
                this.logger?.debug(
                    `Canceling deletion request for ${filePaths.length} temp JS files due to external cancellation.`,
                );
            } else if (fulfilledCondition == internalCancellationIdentifier) {
                this.logger?.debug(
                    `Canceling deletion request for ${filePaths.length} temp JS files due to internal cancellation (e.g. because a testrun has started in the meantime).`,
                );
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
        const { update } = request;

        return update.type == TempJsUpdateType.Creation
            ? `${update.type}-${update.filePath}-${update.tempJsFileContent}-${new Date().getTime()}`
            : `${update.type}-${update.filePaths.join(",")}-${new Date().getTime()}`;
    }
}
