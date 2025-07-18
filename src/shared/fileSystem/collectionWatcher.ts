import {
    EventEmitter,
    ExtensionContext,
    FileSystemWatcher,
    RelativePattern,
    Uri,
    workspace,
} from "vscode";
import { FileChangedEvent, FileChangeType } from "./fileChangesDefinitions";
import { basename } from "path";
import { normalizeDirectoryPath } from "./util/normalizeDirectoryPath";
import { OutputChannelLogger } from "../logging/outputChannelLogger";
import { lstat } from "fs";
import { promisify } from "util";
import { glob } from "glob";

export class CollectionWatcher {
    constructor(
        private context: ExtensionContext,
        private fileChangedEmitter: EventEmitter<FileChangedEvent[]>,
        private logger?: OutputChannelLogger
    ) {}

    private preMessageForLogging = "[CollectionWatcher]";

    private watchers: {
        rootDirectory: string;
        watcher: FileSystemWatcher;
    }[] = [];

    private recentlyCreatedFolder: string | undefined = undefined;

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
            const path = uri.fsPath;
            const isFile = (await promisify(lstat)(path)).isFile();

            if (isFile) {
                this.logger?.debug(
                    `${this.preMessageForLogging} Creation event for file '${path}'.`
                );

                this.fileChangedEmitter.fire([
                    {
                        uri,
                        changeType: FileChangeType.Created,
                    },
                ]);

                return;
            }

            if (this.isNotificationNeededForCreatedFolder(path)) {
                const descendants = await glob(
                    `${
                        path == normalizeDirectoryPath(path)
                            ? path.substring(0, path.length - 1)
                            : path
                    }/**/*`
                );

                this.logger?.debug(
                    `${this.preMessageForLogging} Creation event for directory '${uri.fsPath}' with a total of ${descendants.length} descendants.`
                );

                // When renaming a directory with descendant items, the file system watcher only sends a notification that a directory has been created.
                // It shouldn't hurt to additionally send a notification for each descendant item here (even if it may in some cases be sent multiple times, then).
                this.fileChangedEmitter.fire(
                    [{ uri, changeType: FileChangeType.Created }].concat(
                        descendants.map((path) => ({
                            uri: Uri.file(path),
                            changeType: FileChangeType.Created,
                        }))
                    )
                );
            } else {
                this.logger?.debug(
                    `${this.preMessageForLogging} Not firing event for newly created directory '${uri.fsPath}'.`
                );
            }
        });
        watcher.onDidChange((uri) => {
            this.logger?.debug(
                `${this.preMessageForLogging} Modification event for path '${uri.fsPath}'.`
            );

            this.fileChangedEmitter.fire([
                {
                    uri,
                    changeType: FileChangeType.Modified,
                },
            ]);
        });
        watcher.onDidDelete((uri) => {
            this.logger?.debug(
                `${this.preMessageForLogging} Deletion event for path '${uri.fsPath}'.`
            );
            this.fileChangedEmitter.fire([
                {
                    uri,
                    changeType: FileChangeType.Deleted,
                },
            ]);
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

    private isNotificationNeededForCreatedFolder(path: string): boolean {
        if (!this.recentlyCreatedFolder) {
            this.recentlyCreatedFolder = path;
            this.configureResetForRecentlyCreatedFolder();
            return true;
        }

        const registeredPathNormalized = normalizeDirectoryPath(
            this.recentlyCreatedFolder
        );
        const newPathNormalized = normalizeDirectoryPath(path);

        if (
            !newPathNormalized.startsWith(registeredPathNormalized) ||
            newPathNormalized.length < registeredPathNormalized.length
        ) {
            this.recentlyCreatedFolder = path;
            this.configureResetForRecentlyCreatedFolder();
            return true;
        }

        return false;
    }

    private configureResetForRecentlyCreatedFolder() {
        return setTimeout(
            () => (this.recentlyCreatedFolder = undefined),
            1_000
        );
    }
}
