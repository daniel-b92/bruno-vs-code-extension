import {
    CollectionData,
    CollectionDirectory,
    CollectionItem,
    normalizePath,
} from "..";

export class Collection<T> {
    constructor(
        private rootFolderItem: CollectionDirectory,
        rootFolderAdditionalData: T,
    ) {
        this.testData.push({
            item: rootFolderItem,
            additionalData: rootFolderAdditionalData,
        });
    }

    private testData: CollectionData<T>[] = [];

    public getRootDirectory() {
        return this.rootFolderItem.getPath();
    }

    public isRootDirectory(path: string) {
        return normalizePath(path) == normalizePath(this.getRootDirectory());
    }

    public getCommonAncestorData(...paths: string[]) {
        return this.getAllStoredDataForCollection().filter(({ item }) =>
            paths.every((path) =>
                normalizePath(path).startsWith(normalizePath(item.getPath())),
            ),
        );
    }

    public getStoredDataForPath(path: string) {
        return this.testData.find(
            ({ item }) => normalizePath(item.getPath()) == normalizePath(path),
        );
    }

    public getAllStoredDataForCollection() {
        return this.testData as readonly CollectionData<T>[];
    }

    public addItem(data: CollectionData<T>) {
        this.testData.push(data);
    }

    public removeTestItemAndDescendants(item: CollectionItem) {
        if (!this.removeTestItemIfRegistered(item.getPath())) {
            console.warn(
                `Did not find collection item to be removed with path '${item.getPath()}' for collection root directory '${
                    this.rootFolderItem
                }'.`,
            );
            return;
        }

        if (item instanceof CollectionDirectory) {
            const descendantsToRemove = this.testData.filter(
                ({ item: registered }) =>
                    registered
                        .getPath()
                        .startsWith(normalizePath(item.getPath())),
            );
            for (const { item: toRemove } of descendantsToRemove) {
                this.removeTestItemIfRegistered(toRemove.getPath());
            }
        }
    }

    public removeTestItemIfRegistered(itemPath: string) {
        const itemIndex = this.testData.findIndex(
            ({ item: registered }) =>
                normalizePath(registered.getPath()) == normalizePath(itemPath),
        );

        if (itemIndex != -1) {
            this.testData.splice(itemIndex, 1);
            return true;
        } else {
            return false;
        }
    }
}
