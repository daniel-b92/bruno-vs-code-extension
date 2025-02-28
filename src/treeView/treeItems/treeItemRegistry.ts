import { EventEmitter, FileSystemWatcher, workspace } from "vscode";
import { isCollectionRootDir } from "../../shared/fileSystem/collectionRootFolderHelper";
import { BrunoTreeItem } from "./brunoTreeItem";
import { getPatternForTestitemsInCollection } from "../../shared/fileSystem/getPatternForTestitemsInCollection";
import { FileChangedEvent, FileChangeType } from "../shared/definitions";
import { extname } from "path";

export class TreeItemRegistry {
    constructor(private fileChangedEmitter: EventEmitter<FileChangedEvent>) {}

    private brunoTreeItems: BrunoTreeItem[] = [];

    private collectionWatchers: {
        rootDirectory: string;
        watcher: FileSystemWatcher;
    }[] = [];

    public getItem(path: string) {
        return this.brunoTreeItems.find((item) => item.getPath() == path);
    }

    public async registerItem(item: BrunoTreeItem) {
        this.brunoTreeItems.push(item);

        if (
            (await isCollectionRootDir(item.getPath())) &&
            !this.collectionWatchers.some(
                ({ rootDirectory }) => item.getPath() == rootDirectory
            )
        ) {
            const watcher = this.getWatcherForCollection(item.getPath());

            if (watcher) {
                this.collectionWatchers.push({
                    rootDirectory: item.getPath(),
                    watcher,
                });
            }
        }
    }

    public unregisterItem(path: string) {
        if (!this.brunoTreeItems.some((item) => item.getPath() == path)) {
            console.warn(
                `No tree item with path '${path}' found for unregistering.`
            );
        } else {
            this.brunoTreeItems.splice(
                this.brunoTreeItems.findIndex((item) => item.getPath() == path),
                1
            );

            if (
                this.collectionWatchers.some(
                    ({ rootDirectory }) => path == rootDirectory
                )
            ) {
                const { watcher } = this.collectionWatchers.splice(
                    this.collectionWatchers.findIndex(
                        ({ rootDirectory }) => rootDirectory == path
                    ),
                    1
                )[0];
                watcher.dispose();
            }
        }
    }

    public unregisterAllDescendants(directoryPath: string) {
        const normalizePath = () => {
            const usesSlashes = directoryPath.includes("/");

            if (usesSlashes) {
                return directoryPath.endsWith("/")
                    ? directoryPath
                    : `${directoryPath}/`;
            } else {
                return directoryPath.endsWith("\\")
                    ? directoryPath
                    : `${directoryPath}\\`;
            }
        };

        if (extname(directoryPath) != "") {
            // If the given path is for a file, abort.
            return;
        }

        const normalizedDirPath = normalizePath();
        const descendants = this.brunoTreeItems.filter(
            (item) =>
                item.getPath().startsWith(normalizedDirPath) &&
                item.getPath().length > normalizedDirPath.length
        );

        for (const descendant of descendants) {
            this.brunoTreeItems.splice(
                this.brunoTreeItems.findIndex(
                    (item) => item.getPath() == descendant.getPath()
                ),
                1
            );
        }
    }

    private getWatcherForCollection(collectionRootDir: string) {
        const testPattern =
            getPatternForTestitemsInCollection(collectionRootDir);

        if (!testPattern) {
            return undefined;
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

        return watcher;
    }
}
