import { BrunoTreeItem } from "./brunoTreeItem";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFile } from "./collectionFile";
import { CollectionData } from "./interfaces";
import { TestRunnerDataHelper } from "../testRunnerDataHelper";

export class Collection {
    constructor(private rootDirectory: string) {
        this.testData.push({
            item: new CollectionDirectory(rootDirectory),
            treeItem: new BrunoTreeItem(rootDirectory, false),
        });
    }

    private testData: CollectionData[] = [];

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
        return this.testData as readonly CollectionData[];
    }

    public addItem(
        item: CollectionDirectory | CollectionFile,
        testRunnerDataHelper: TestRunnerDataHelper,
        withTestTreeItem = false
    ) {
        const data: CollectionData = {
            item,
            treeItem: new BrunoTreeItem(
                item.getPath(),
                item instanceof CollectionFile,
                item instanceof CollectionFile ? item.getSequence() : undefined
            ),
            testItem: withTestTreeItem
                ? testRunnerDataHelper.createVsCodeTestItem(item)
                : undefined,
        };

        this.testData.push(data);
        return data;
    }

    public removeTestItemAndDescendants(
        item: CollectionDirectory | CollectionFile
    ) {
        if (!this.removeTestItemIfRegistered(item.getPath())) {
            console.warn(
                `Did not find collection item to be removed with path '${item.getPath()}' for collection root directory '${
                    this.rootDirectory
                }'.`
            );
            return;
        }

        if (item instanceof CollectionDirectory) {
            const descendantsToRemove = this.testData.filter(
                ({ item: registered }) =>
                    registered
                        .getPath()
                        .startsWith(normalizeDirectoryPath(item.getPath()))
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
                normalizeDirectoryPath(itemPath)
        );

        if (itemIndex != -1) {
            this.testData.splice(itemIndex, 1);
            return true;
        } else {
            return false;
        }
    }
}
