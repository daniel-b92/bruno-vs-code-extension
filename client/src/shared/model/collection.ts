import { normalizeDirectoryPath } from "@global_shared";
import { CollectionData, CollectionDirectory, CollectionItem } from "@shared";

export class Collection<T> {
    constructor(
        private rootDirectory: string,
        additionalDataCreator: (item: CollectionItem) => T,
    ) {
        const item = new CollectionDirectory(rootDirectory);

        this.testData.push({
            item,
            additionalData: additionalDataCreator(item),
        });
    }

    private testData: CollectionData<T>[] = [];

    public getRootDirectory() {
        return this.rootDirectory;
    }

    public isRootDirectory(path: string) {
        return (
            normalizeDirectoryPath(path) ==
            normalizeDirectoryPath(this.getRootDirectory())
        );
    }

    public getStoredDataForPath(path: string) {
        return this.testData.find(({ item }) => item.getPath() == path);
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
                    this.rootDirectory
                }'.`,
            );
            return;
        }

        if (item instanceof CollectionDirectory) {
            const descendantsToRemove = this.testData.filter(
                ({ item: registered }) =>
                    registered
                        .getPath()
                        .startsWith(normalizeDirectoryPath(item.getPath())),
            );
            for (const { item: toRemove } of descendantsToRemove) {
                this.removeTestItemIfRegistered(toRemove.getPath());
            }
        }
    }

    public removeTestItemIfRegistered(itemPath: string) {
        const itemIndex = this.testData.findIndex(
            ({ item: registered }) =>
                normalizeDirectoryPath(registered.getPath()) ==
                normalizeDirectoryPath(itemPath),
        );

        if (itemIndex != -1) {
            this.testData.splice(itemIndex, 1);
            return true;
        } else {
            return false;
        }
    }
}
