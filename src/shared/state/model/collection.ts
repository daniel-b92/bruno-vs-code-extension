import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFile } from "./collectionFile";

export class Collection {
    constructor(private rootDirectory: string) {
        this.testData.push(new CollectionDirectory(rootDirectory));
    }

    private testData: (CollectionDirectory | CollectionFile)[] = [];

    public getRootDirectory() {
        return this.rootDirectory;
    }

    public getTestItemForPath(path: string) {
        return this.testData.find((item) => item.getPath() == path);
    }

    public addTestItem(item: CollectionDirectory | CollectionFile) {
        this.testData.push(item);
    }

    public removeTestItemAndDescendants(
        item: CollectionDirectory | CollectionFile
    ) {
        if (!this.removeTestItemIfRegistered(item)) {
            console.warn(
                `Did not find collection item to be removed with path '${item.getPath()}' for collection root directory '${
                    this.rootDirectory
                }'.`
            );
            return;
        }

        if (item instanceof CollectionDirectory) {
            const descendantsToRemove = this.testData.filter((registered) =>
                registered
                    .getPath()
                    .startsWith(normalizeDirectoryPath(item.getPath()))
            );
            for (const toRemove of descendantsToRemove) {
                this.removeTestItemIfRegistered(toRemove);
            }
        }
    }

    private removeTestItemIfRegistered(
        item: CollectionDirectory | CollectionFile
    ) {
        const itemIndex = this.testData.findIndex(
            (registered) =>
                normalizeDirectoryPath(registered.getPath()) ==
                normalizeDirectoryPath(item.getPath())
        );

        if (itemIndex != -1) {
            this.testData.splice(itemIndex, 1);
            return true;
        } else {
            return false;
        }
    }
}
