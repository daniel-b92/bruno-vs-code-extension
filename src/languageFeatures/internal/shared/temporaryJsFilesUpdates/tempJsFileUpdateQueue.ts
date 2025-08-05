import { TempJsUpdateRequest, TempJsUpdateType } from "./internal/interfaces";
import { TemporaryJsFilesRegistry } from "./internal/temporaryJsFilesRegistry";
import {
    checkIfPathExistsAsync,
    getTemporaryJsFileName,
    OutputChannelLogger,
} from "../../../../shared";
import { createTemporaryJsFile } from "./internal/createTemporaryJsFile";
import { deleteTemporaryJsFileForCollection } from "./internal/deleteTemporaryJsFile";
import { CancellationToken, EventEmitter } from "vscode";

export class TempJsFileUpdateQueue {
    constructor(
        private registry: TemporaryJsFilesRegistry,
        private logger?: OutputChannelLogger,
    ) {
        this.queue = [];
        this.activeUpdate = undefined;
        this.latestRequestBruFileContent = undefined;
    }

    private queue: { request: TempJsUpdateRequest; id: string }[];
    private activeUpdate:
        | { request: TempJsUpdateRequest; id: string }
        | undefined;
    private updateCanRunNotifier = new EventEmitter<string>();
    private latestRequestBruFileContent: string | undefined;

    public async addToQueue(updateRequest: TempJsUpdateRequest) {
        const id = this.getIdForRequest(updateRequest);

        this.queue.push({
            request: updateRequest,
            id,
        });

        if (this.queue.length > 2) {
            this.logger?.trace(
                `More than 2 temp JS update requests exist. Current queue length: ${this.queue.length}`,
            );
        }

        const { cancellationToken: token } = updateRequest;

        if (token && token.isCancellationRequested) {
            return;
        }

        return this.queue.length > 1 || this.activeUpdate
            ? await this.waitForRequestToBeAbleToRunOrCancelled(id, token).then(
                  (shouldRun) => {
                      if (shouldRun) {
                          this.triggerUpdate(id, token);
                      }
                  },
              )
            : await this.triggerUpdate(id, token);
    }

    public dispose() {
        this.updateCanRunNotifier.dispose();
        this.registry.dispose();
        this.queue.splice(0);
        this.activeUpdate = undefined;
    }

    private async waitForRequestToBeAbleToRunOrCancelled(
        requestId: string,
        token?: CancellationToken,
    ) {
        return await new Promise<boolean>((resolve) => {
            if (token) {
                token.onCancellationRequested(() => {
                    if (this.removeFromQueue(requestId)) {
                        resolve(false);
                    }
                });
            }

            this.updateCanRunNotifier.event((id) => {
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
        const { request } = this.getRequestFromQueue(requestId);

        if (token && token.isCancellationRequested) {
            return;
        }

        this.activeUpdate = request;

        const {
            request: { collectionRootFolder, update },
        } = request;

        if (
            update.type == TempJsUpdateType.Creation &&
            update.bruFileContent != this.latestRequestBruFileContent
        ) {
            await createTemporaryJsFile(
                collectionRootFolder,
                this.registry,
                update.bruFileContent,
                this.logger,
            );

            this.latestRequestBruFileContent = update.bruFileContent;
        } else if (
            update.type == TempJsUpdateType.Deletion &&
            (await checkIfPathExistsAsync(
                getTemporaryJsFileName(collectionRootFolder),
            ))
        ) {
            await deleteTemporaryJsFileForCollection(
                this.registry,
                collectionRootFolder,
                this.logger,
            );

            this.latestRequestBruFileContent = undefined;
        }

        this.activeUpdate = undefined;
        this.removeFromQueue(requestId);

        if (this.queue.length > 0) {
            this.updateCanRunNotifier.fire(this.queue[0].id);
        }

        if (token && token.isCancellationRequested) {
            this.logger?.debug(
                `Cancellation requested for temp JS update with ID '${requestId}' after triggering workspace edit. Could not be aborted anymore.`,
            );
        }
    }

    private removeFromQueue(requestId: string) {
        if (this.activeUpdate && this.activeUpdate.id == requestId) {
            this.logger?.debug(
                `Could not remove temp JS update for id '${requestId}' from queue because it's currently active.`,
            );

            return false;
        }

        const { index } = this.getRequestFromQueue(requestId);
        this.queue.splice(index, 1);

        return true;
    }

    private getRequestFromQueue(requestId: string) {
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

    private getIdForRequest(request: TempJsUpdateRequest) {
        const { collectionRootFolder, update } = request;
        return `${collectionRootFolder}-${update.type == TempJsUpdateType.Creation ? `${update.bruFileContent}` : update.type}-${new Date().getTime()}`;
    }
}
