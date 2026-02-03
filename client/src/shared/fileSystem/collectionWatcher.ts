import { FileChangedEvent, FileChangeType } from "./interfaces";
import { basename } from "path";
import { normalizeDirectoryPath } from "@global_shared";
import { OutputChannelLogger } from "../logging/outputChannelLogger";
import { glob } from "glob";
import { Evt } from "evt";
import Watcher from "watcher";
import { TargetEvent } from "watcher/dist/enums";

export class CollectionWatcher {
    constructor(
        private fileChangedEmitter: Evt<FileChangedEvent>,
        private workSpaceFolders: string[],
        private logger?: OutputChannelLogger,
    ) {}

    private preMessageForLogging = "[CollectionWatcher]";
    private fileChangeEmitterContext = Evt.newCtx();

    private watchers: {
        rootDirectory: string;
        watcher: Watcher;
    }[] = [];

    public startWatchingCollection(rootDirectory: string) {
        this.logger?.info(
            `${
                this.preMessageForLogging
            } Starting to watch collection '${basename(
                rootDirectory,
            )}' for changes.`,
        );

        if (
            !this.isWithinWorkspaceFolders(rootDirectory) ||
            this.watchers.some(
                ({ rootDirectory: watched }) =>
                    normalizeDirectoryPath(watched) ==
                    normalizeDirectoryPath(rootDirectory),
            )
        ) {
            return;
        }
        const watcher = new Watcher(
            rootDirectory,
            {
                depth: 100,
                recursive: true,
            },
            async (event, path) => {
                switch (event) {
                    case TargetEvent.ADD:
                        this.logger?.debug(
                            `${this.preMessageForLogging} Creation event for file '${path}'.`,
                        );

                        this.fileChangedEmitter.post({
                            path,
                            changeType: FileChangeType.Created,
                        });

                        break;

                    case TargetEvent.ADD_DIR:
                        const descendants = await glob(
                            `${
                                path == normalizeDirectoryPath(path)
                                    ? path.substring(0, path.length - 1)
                                    : path
                            }/**/*`,
                        );

                        this.logger?.debug(
                            `${this.preMessageForLogging} Creation event for directory '${path}' with a total of ${descendants.length} descendants.`,
                        );

                        // When renaming a directory with descendant items, the file system watcher only sends a notification that a directory has been created.
                        // It shouldn't hurt to additionally send a notification for each descendant item here (even if it may in some cases be sent multiple times, then).
                        [path].concat(descendants).forEach((path) => {
                            this.fileChangedEmitter.post({
                                path,
                                changeType: FileChangeType.Created,
                            });
                        });
                        break;

                    case TargetEvent.CHANGE:
                        this.logger?.debug(
                            `${this.preMessageForLogging} Modification event for path '${path}'.`,
                        );

                        this.fileChangedEmitter.post({
                            path,
                            changeType: FileChangeType.Modified,
                        });
                        break;

                    case TargetEvent.UNLINK:
                    case TargetEvent.UNLINK_DIR:
                        this.logger?.debug(
                            `${this.preMessageForLogging} Deletion event for path '${path}'.`,
                        );
                        this.fileChangedEmitter.post({
                            path,
                            changeType: FileChangeType.Deleted,
                        });
                        break;
                }
            },
        );

        this.watchers.push({ rootDirectory, watcher });
    }

    public stopWatchingCollection(path: string) {
        if (this.watchers.some(({ rootDirectory }) => path == rootDirectory)) {
            const { watcher } = this.watchers.splice(
                this.watchers.findIndex(
                    ({ rootDirectory }) => rootDirectory == path,
                ),
                1,
            )[0];
            watcher.close();
        }
    }

    public subscribeToUpdates(callback: (e: FileChangedEvent) => void) {
        this.fileChangedEmitter.attach(this.fileChangeEmitterContext, callback);
    }

    public dispose() {
        this.fileChangeEmitterContext.done();

        for (const { watcher } of this.watchers.splice(0)) {
            watcher.close();
        }

        this.logger?.dispose();
    }

    private isWithinWorkspaceFolders(collectionRootDir: string) {
        return this.workSpaceFolders.some((folder) =>
            normalizeDirectoryPath(collectionRootDir).includes(
                normalizeDirectoryPath(folder),
            ),
        );
    }
}
