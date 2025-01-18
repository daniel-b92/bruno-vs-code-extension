import * as vscode from "vscode";
import { TestCollection } from "../model/testCollection";
import { dirname } from "path";
import { lstatSync } from "fs";
import { addTestItem } from "./addTestItem";
import { TestDirectory } from "../model/testDirectory";
import { getSequence } from "../fileSystem/parser";
import { TestFile } from "../model/testFile";
import { getTestfileDescendants } from "../fileSystem/getTestfileDescendants";

type PathWithChildren = {
    path: string;
    childItems: vscode.TestItem[];
};

export async function addAllTestItemsForCollections(
    controller: vscode.TestController,
    testCollections: TestCollection[]
) {
    for (const collection of testCollections) {
        await addTestItemsForCollection(controller, collection);
    }
}

async function addTestItemsForCollection(
    controller: vscode.TestController,
    collection: TestCollection
) {
    const relevantFiles = await getTestfileDescendants(
        collection.rootDirectory
    );
    let currentPaths: PathWithChildren[] = relevantFiles.map((path) => ({
        path: path.fsPath,
        childItems: [],
    }));
    let currentTestItems: vscode.TestItem[];

    while (currentPaths.length > 0) {
        currentTestItems = [];

        currentPaths.forEach(({ path, childItems }) => {
            const uri = vscode.Uri.file(path);
            const isFile = lstatSync(path).isFile();
            let testItem: vscode.TestItem | undefined;

            if (!isFile) {
                testItem = Array.from(collection.testData.keys()).find(
                    (item) => item.uri?.fsPath == path
                );

                if (!testItem) {
                    addTestItem(
                        controller,
                        collection,
                        new TestDirectory(path)
                    );
                }

                childItems.forEach((childItem) =>
                    testItem!.children.add(childItem)
                );
            } else {
                const sequence = getSequence(path);
                if (sequence) {
                    addTestItem(
                        controller,
                        collection,
                        new TestFile(path, sequence)
                    );
                }
            }
            if (testItem) {
                currentTestItems.push(testItem);
            }
        });

        currentPaths = switchToParentDirectory(
            collection,
            currentPaths,
            currentTestItems
        );
    }
}

const getUniquePaths = (arr: PathWithChildren[]) => {
    let result: PathWithChildren[] = [];

    arr.forEach(({ path, childItems }) => {
        if (!result.some((val) => val.path == path)) {
            result.push({ path, childItems });
        } else {
            const arrayIndex = result.findIndex((val) => val.path == path);
            result[arrayIndex] = {
                path,
                childItems: result[arrayIndex].childItems.concat(childItems),
            };
        }
    });

    return result;
};

const switchToParentDirectory = (
    collection: TestCollection,
    pathsWithChildren: PathWithChildren[],
    currentTestItems: vscode.TestItem[]
) => {
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
        .filter(({ path }) => path.includes(collection.rootDirectory));

    return getUniquePaths(parentsWithDuplicatePaths);
};
