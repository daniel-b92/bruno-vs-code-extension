import * as vscode from "vscode";
import { CollectionFile } from "./model/collectionFile";
import { CollectionData, CollectionItem } from "./model/interfaces";
import {
    getTestId,
    getTestLabel,
} from "../../testRunner/vsCodeTestTree/utils/testTreeHelper";
import { Collection } from "./model/collection";
import { CollectionDirectory } from "./model/collectionDirectory";
import { dirname, extname } from "path";
import { lstatSync } from "fs";
import { addTestItemToTestTree } from "../../testRunner/vsCodeTestTree/utils/addTestItemToTestTree";

interface PathWithChildren {
    path: string;
    childItems: vscode.TestItem[];
}

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const getSortText = (file: CollectionFile) =>
            file.getSequence()
                ? new Array((file.getSequence() as number) + 1).join("a")
                : undefined;

        const uri = vscode.Uri.file(item.getPath());
        const testItem = this.testController.createTestItem(
            getTestId(uri),
            getTestLabel(uri),
            uri
        );

        if (item instanceof CollectionFile) {
            testItem.canResolveChildren = false;
            testItem.sortText = getSortText(item);
        } else {
            testItem.canResolveChildren = true;
        }

        return testItem;
    };

    public addTestTreeItemsForCollection(collection: Collection) {
        const collectionDirectoryItem = (
            collection.getStoredDataForPath(
                collection.getRootDirectory()
            ) as CollectionData
        ).item as CollectionDirectory;

        const relevantFiles = this.getRelevantFilesForTestTree(collection);

        const testFileItems = relevantFiles.map((data) => {
            const testItem = this.createVsCodeTestItem(data.item);
            data.testItem = testItem;
            addTestItemToTestTree(this.testController, collection, testItem);
            return testItem;
        });

        let currentPaths = this.switchToParentDirsContainingAncestorPath(
            relevantFiles.map(({ item }) => ({
                path: item.getPath(),
                childItems: [],
            })),
            testFileItems,
            collectionDirectoryItem
        );

        while (currentPaths.length > 0) {
            const currentTestItems: vscode.TestItem[] = [];

            currentPaths.forEach(({ path, childItems }) => {
                const registeredItem = collection.getStoredDataForPath(path);

                if (!registeredItem) {
                    throw new Error(
                        `No item registered for path '${path}'. Cannot add test tree item to an already existing tiem therefore.`
                    );
                }

                const testItem: vscode.TestItem = registeredItem.testItem
                    ? registeredItem.testItem
                    : this.createVsCodeTestItem(registeredItem.item);

                if (!registeredItem.testItem) {
                    registeredItem.testItem = testItem;
                    addTestItemToTestTree(
                        this.testController,
                        collection,
                        testItem
                    );
                }

                childItems.forEach((childItem) =>
                    testItem.children.add(childItem)
                );
                currentTestItems.push(testItem);
            });

            currentPaths = this.switchToParentDirsContainingAncestorPath(
                currentPaths,
                currentTestItems,
                collectionDirectoryItem
            );
        }
    }

    private getRelevantFilesForTestTree(collection: Collection) {
        return collection
            .getAllStoredDataForCollection()
            .filter(
                ({ item }) =>
                    lstatSync(item.getPath()).isFile() &&
                    extname(item.getPath()) == ".bru" &&
                    item instanceof CollectionFile &&
                    item.getSequence() != undefined
            );
    }

    private switchToParentDirsContainingAncestorPath(
        pathsWithChildren: PathWithChildren[],
        currentTestItems: vscode.TestItem[],
        ancestorDirectory: CollectionDirectory
    ) {
        const parentsWithDuplicatePaths: PathWithChildren[] = pathsWithChildren
            .map(({ path }) => {
                const parentPath = dirname(path);
                const childTestItem = currentTestItems.find(
                    (item) => item.uri?.fsPath == path
                );
                return {
                    path: parentPath,
                    childItems: childTestItem ? [childTestItem] : [],
                };
            })
            .filter(({ path }) => path.includes(ancestorDirectory.getPath()));

        return this.getUniquePaths(parentsWithDuplicatePaths);
    }

    private getUniquePaths(arr: PathWithChildren[]) {
        const result: PathWithChildren[] = [];

        arr.forEach(({ path, childItems }) => {
            if (!result.some((val) => val.path == path)) {
                result.push({ path, childItems });
            } else {
                const arrayIndex = result.findIndex((val) => val.path == path);
                result[arrayIndex] = {
                    path,
                    childItems:
                        result[arrayIndex].childItems.concat(childItems),
                };
            }
        });

        return result;
    }
}
