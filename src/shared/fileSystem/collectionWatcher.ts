import {
    EventEmitter,
    ExtensionContext,
    FileSystemWatcher,
    RelativePattern,
    workspace,
} from "vscode";
import { FileChangedEvent, FileChangeType } from "../definitions";
import { basename } from "path";
import { normalizeDirectoryPath } from "./normalizeDirectoryPath";

export class CollectionWatcher {
    constructor(
        private context: ExtensionContext,
        private fileChangedEmitter: EventEmitter<FileChangedEvent>
    ) {}

    private watchers: {
        rootDirectory: string;
        watcher: FileSystemWatcher;
    }[] = [];

    public startWatchingCollection(rootDirectory: string) {
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

        watcher.onDidCreate((uri) => {
            this.fileChangedEmitter.fire({
                uri,
                changeType: FileChangeType.Created,
            });
        });
        watcher.onDidChange((uri) => {
            this.fileChangedEmitter.fire({
                uri,
                changeType: FileChangeType.Modified,
            });
        });
        watcher.onDidDelete((uri) => {
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
        return this.fileChangedEmitter;
    }

    private getPatternForTestitemsInCollection(collectionRootDir: string) {
        if (!workspace.workspaceFolders) {
            return undefined;
        }

        const maybeWorkspaceFolder = workspace.workspaceFolders.find((folder) =>
            collectionRootDir.includes(folder.uri.fsPath)
        );

        return maybeWorkspaceFolder
            ? new RelativePattern(
                  maybeWorkspaceFolder,
                  `{**/${basename(collectionRootDir)},**/${basename(
                      collectionRootDir
                  )}/**/*}`
              )
            : undefined;
    }
}
