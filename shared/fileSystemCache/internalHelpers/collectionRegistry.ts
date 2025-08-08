import { CollectionWatcher } from "../../fileSystem/collectionWatcher";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { Collection } from "../../model/collection";

export class CollectionRegistry {
    constructor(private collectionWatcher: CollectionWatcher) {}

    private collections: Collection[] = [];

    public getRegisteredCollections() {
        return this.collections as readonly Collection[];
    }

    public registerCollection(collection: Collection) {
        if (!this.isCollectionRegistered(collection.getRootDirectory())) {
            this.collectionWatcher.startWatchingCollection(
                collection.getRootDirectory()
            );

            this.collections.push(collection);
        } else {
            console.warn(
                `Collection with root directory '${collection.getRootDirectory()}' is already registered. Skipped registering it again.`
            );
        }
    }

    public unregisterCollection(rootDirectory: string) {
        if (this.isCollectionRegistered(rootDirectory)) {
            const collection = this.collections.splice(
                this.collections.findIndex(
                    (collection) =>
                        normalizeDirectoryPath(collection.getRootDirectory()) ==
                        normalizeDirectoryPath(rootDirectory)
                ),
                1
            )[0];

            this.collectionWatcher.stopWatchingCollection(rootDirectory);
            return collection;
        } else {
            console.warn(
                `No registered collection with root directory '${rootDirectory}' found for unregistering.`
            );
            return undefined;
        }
    }

    public dispose() {
        this.collections.splice(0);
    }

    private isCollectionRegistered(rootDirectory: string) {
        return this.collections.some(
            (registered) =>
                normalizeDirectoryPath(registered.getRootDirectory()) ==
                normalizeDirectoryPath(rootDirectory)
        );
    }
}
