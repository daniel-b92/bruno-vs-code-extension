import { BrunoTreeItem } from "./brunoTreeItem";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFile } from "./collectionFile";
import { CollectionData } from "./interfaces";
import { TestRunnerDataHelper } from "../testRunnerDataHelper";
import { dirname } from "path";

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

        const maybeRegisteredParent = this.getStoredDataForPath(
            dirname(item.getPath())
        );

        if (
            data.testItem &&
            maybeRegisteredParent &&
            maybeRegisteredParent.testItem
        ) {
            maybeRegisteredParent.testItem.children.add(data.testItem);
        }

        this.testData.push(data);
        return data;
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
            const descendantsToRemove = this.testData.filter(
                ({ item: registered }) =>
                    registered
                        .getPath()
                        .startsWith(normalizeDirectoryPath(item.getPath()))
            );
            for (const { item: toRemove } of descendantsToRemove) {
                this.removeTestItemIfRegistered(toRemove);
            }
        }
    }

    private removeTestItemIfRegistered(
        item: CollectionDirectory | CollectionFile
    ) {
        const itemIndex = this.testData.findIndex(
            ({ item: registered }) =>
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
