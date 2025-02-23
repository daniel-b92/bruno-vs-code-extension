import { EventEmitter, FileSystemWatcher, Uri, workspace } from "vscode";
import { isCollectionRootDir } from "../shared/fileSystem/collectionRootFolderHelper";
import { BrunoTreeItem } from "./brunoTreeItem";
import { getPatternForTestitemsInCollection } from "../shared/fileSystem/getPatternForTestitemsInCollection";

export class BrunoTestItemRegistry {
    constructor(private fileChangedEmitter: EventEmitter<Uri>) {}

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

    private getWatcherForCollection(collectionRootDir: string) {
        const testPattern =
            getPatternForTestitemsInCollection(collectionRootDir);

        if (!testPattern) {
            return undefined;
        }
        const watcher = workspace.createFileSystemWatcher(testPattern);

        watcher.onDidCreate((uri) => {
            this.fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange((uri) => {
            this.fileChangedEmitter.fire(uri);
        });
        watcher.onDidDelete((uri) => {
            this.fileChangedEmitter.fire(uri);
        });

        return watcher;
    }
}
