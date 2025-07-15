import {
    EventEmitter,
    ExtensionContext,
    FileSystemWatcher,
    RelativePattern,
    workspace,
} from "vscode";
import { FileChangedEvent, FileChangeType } from "./fileChangesDefinitions";
import { basename } from "path";
import { normalizeDirectoryPath } from "./util/normalizeDirectoryPath";
import { OutputChannelLogger } from "../logging/outputChannelLogger";
import { lstat } from "fs";
import { promisify } from "util";

export class CollectionWatcher {
    constructor(
        private context: ExtensionContext,
        private fileChangedEmitter: EventEmitter<FileChangedEvent>,
        private logger?: OutputChannelLogger
    ) {}

    private preMessageForLogging = "[CollectionWatcher]";

    private watchers: {
        rootDirectory: string;
        watcher: FileSystemWatcher;
    }[] = [];

    public startWatchingCollection(rootDirectory: string) {
        this.logger?.info(
            `${
                this.preMessageForLogging
            } Starting to watch collection '${basename(
                rootDirectory
            )}' for changes.`
        );
        const testPattern =
            this.getPatternForTestitemsInCollection(rootDirectory);

        if (
            this.watchers.some(
                ({ rootDirectory: watched }) =>
                    normalizeDirectoryPath(watched) ==
                    normalizeDirectoryPath(rootDirectory)
            ) ||
            !testPattern
        ) {
            return;
        }
        const watcher = workspace.createFileSystemWatcher(testPattern);

        watcher.onDidCreate(async (uri) => {
            this.fileChangedEmitter.fire({
                uri,
                changeType: FileChangeType.Created,
            });

            this.logger?.debug(
                `${this.preMessageForLogging} Handling file system creation event for path '${uri.fsPath}'.`
            );

            const path = uri.fsPath;

            if ((await promisify(lstat)(path)).isDirectory()) {
                const descendants = await workspace.findFiles(
                    new RelativePattern(path, "**/*")
                );

                this.logger?.debug(
                    `${this.preMessageForLogging} Created item was a directory. Firing events for all  '${descendants.length}}' descendants that were created, too.`
                );

                // When renaming a directory with descendant items, the file system watcher only sends a notification that a directory has been created.
                // It shouldn't hurt to additionally send a notification for each descendant item here (even if it may in some cases be sent multiple times, then).
                descendants.forEach((uri) => {
                    this.fileChangedEmitter.fire({
                        uri,
                        changeType: FileChangeType.Created,
                    });
                });
            }
        });
        watcher.onDidChange((uri) => {
            this.logger?.debug(
                `${this.preMessageForLogging} Modification event for path '${uri.fsPath}'.`
            );

            this.fileChangedEmitter.fire({
                uri,
                changeType: FileChangeType.Modified,
            });
        });
        watcher.onDidDelete((uri) => {
            this.logger?.debug(
                `${this.preMessageForLogging} Deletion event for path '${uri.fsPath}'.`
            );
            this.fileChangedEmitter.fire({
                uri,
                changeType: FileChangeType.Deleted,
            });
        });

        this.watchers.push({ rootDirectory, watcher });
        this.context.subscriptions.push(watcher);
    }

    public stopWatchingCollection(path: string) {
        if (this.watchers.some(({ rootDirectory }) => path == rootDirectory)) {
            const { watcher } = this.watchers.splice(
                this.watchers.findIndex(
                    ({ rootDirectory }) => rootDirectory == path
                ),
                1
            )[0];
            watcher.dispose();
        }
    }

    public subscribeToUpdates() {
        return this.fileChangedEmitter.event;
    }

    private getPatternForTestitemsInCollection(collectionRootDir: string) {
        if (!workspace.workspaceFolders) {
            return undefined;
        }

        const maybeWorkspaceFolder = workspace.workspaceFolders.find((folder) =>
            normalizeDirectoryPath(collectionRootDir).includes(
                normalizeDirectoryPath(folder.uri.fsPath)
            )
        );

        if (!maybeWorkspaceFolder) {
            return undefined;
        }

        return new RelativePattern(
            maybeWorkspaceFolder,
            normalizeDirectoryPath(collectionRootDir) !=
            normalizeDirectoryPath(maybeWorkspaceFolder.uri.fsPath)
                ? `{**/${basename(collectionRootDir)},**/${basename(
                      collectionRootDir
                  )}/**/*}`
                : `{*/,**/*}`
        );
    }
}
