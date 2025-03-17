import { isCollectionRootDir } from "../../shared/fileSystem/collectionRootFolderHelper";
import { BrunoTreeItem } from "./brunoTreeItem";
import { extname } from "path";
import { CollectionWatcher } from "../../shared/fileSystem/collectionWatcher";
import { normalizeDirectoryPath } from "../../shared/fileSystem/normalizeDirectoryPath";

export class TreeItemRegistry {
    constructor(private collectionWatcher: CollectionWatcher) {}

    private brunoTreeItems: BrunoTreeItem[] = [];

    private registeredCollections: {
        rootDirectory: string;
    }[] = [];

    public getItem(path: string) {
        return this.brunoTreeItems.find((item) => item.getPath() == path);
    }

    public async registerItem(item: BrunoTreeItem) {
        this.brunoTreeItems.push(item);

        if (
            (await isCollectionRootDir(item.getPath())) &&
            !this.registeredCollections.some(
                ({ rootDirectory }) => item.getPath() == rootDirectory
            )
        ) {
            this.collectionWatcher.startWatchingCollection(item.getPath());

            this.registeredCollections.push({
                rootDirectory: item.getPath(),
            });
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
                this.registeredCollections.some(
                    ({ rootDirectory }) => path == rootDirectory
                )
            ) {
                this.registeredCollections.splice(
                    this.registeredCollections.findIndex(
                        (collection) => collection.rootDirectory == path
                    ),
                    1
                );

                this.collectionWatcher.stopWatchingCollection(path);
            }
        }
    }

    public unregisterAllDescendants(directoryPath: string) {
        if (extname(directoryPath) != "") {
            // If the given path is for a file, abort.
            return;
        }

        const normalizedDirPath = normalizeDirectoryPath(directoryPath);
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
}
