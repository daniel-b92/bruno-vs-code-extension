import { TempJsUpdateRequest, TempJsUpdateType } from "./internal/interfaces";
import { TemporaryJsFilesRegistry } from "./internal/temporaryJsFilesRegistry";
import { OutputChannelLogger } from "../../../../shared";
import { createTemporaryJsFile } from "./internal/createTemporaryJsFile";
import { deleteTemporaryJsFileForCollection } from "./internal/deleteTemporaryJsFile";
import { EventEmitter } from "vscode";

export class TempJsFileUpdateQueue {
    constructor(
        private registry: TemporaryJsFilesRegistry,
        private logger?: OutputChannelLogger,
    ) {
        this.queue = [];
        this.activeUpdate = undefined;
    }

    private queue: { request: TempJsUpdateRequest; id: string }[];
    private activeUpdate:
        | { request: TempJsUpdateRequest; id: string }
        | undefined;
    private updateCanRunNotifier = new EventEmitter<string>();

    public async addToQueue(updateRequest: TempJsUpdateRequest) {
        const id = this.getIdForRequest(updateRequest);

        this.queue.push({
            request: updateRequest,
            id,
        });

        return this.queue.length > 1 || this.activeUpdate
            ? await this.waitForRequestToBeAbleToRun(id).then(() =>
                  this.triggerUpdate(id),
              )
            : await this.triggerUpdate(id);
    }

    public dispose() {
        this.updateCanRunNotifier.dispose();
        this.registry.dispose();
        this.queue.splice(0);
        this.activeUpdate = undefined;
    }

    private async waitForRequestToBeAbleToRun(requestId: string) {
        await new Promise<void>((resolve) => {
            this.updateCanRunNotifier.event((id) => {
                if (id == requestId) {
                    resolve();
                }
            });
        });
    }

    private async triggerUpdate(requestId: string) {
        const matchingRequests = this.queue.filter(
            (queued) => requestId == queued.id,
        );

        if (matchingRequests.length != 1) {
            throw new Error(
                `Could not find exactly one temp JS update request in queue to trigger for ID '${requestId}'.
                Found ${matchingRequests.length} queued items matching the given ID.`,
            );
        }

        this.activeUpdate = matchingRequests[0];

        const {
            request: { collectionRootFolder, update },
        } = matchingRequests[0];

        if (update.type == TempJsUpdateType.Creation) {
            await createTemporaryJsFile(
                collectionRootFolder,
                this.registry,
                update.newContent,
                this.logger,
            );
        } else if (update.type == TempJsUpdateType.Deletion) {
            await deleteTemporaryJsFileForCollection(
                this.registry,
                collectionRootFolder,
                this.logger,
            );
        }

        this.queue.splice(
            this.queue.findIndex((queued) => requestId == queued.id) as number,
            1,
        );

        this.activeUpdate = undefined;

        if (this.queue.length > 0) {
            this.updateCanRunNotifier.fire(this.queue[0].id);
        }
    }

    private getIdForRequest(request: TempJsUpdateRequest) {
        const { collectionRootFolder, filePath, update } = request;
        return `${collectionRootFolder}-${filePath}-${update.type == TempJsUpdateType.Creation ? `${update.newContent}` : update.type}-${new Date().getTime}`;
    }
}
