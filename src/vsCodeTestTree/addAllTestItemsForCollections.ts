import { TestCollection } from "../model/testCollection";
import { dirname } from "path";
import { lstatSync } from "fs";
import { addTestItem } from "./addTestItem";
import { TestDirectory } from "../model/testDirectory";
import { getSequence } from "../fileSystem/parser";
import { TestFile } from "../model/testFile";
import { getTestfileDescendants } from "../fileSystem/getTestfileDescendants";
import { TestController, Uri, TestItem as vscodeTestItem } from "vscode";

type PathWithChildren = {
    path: string;
    childItems: vscodeTestItem[];
};

export async function addAllTestItemsForCollections(
    controller: TestController,
    testCollections: TestCollection[]
) {
    for (const collection of testCollections) {
        await addTestItemsForCollection(controller, collection);
    }
}

async function addTestItemsForCollection(
    controller: TestController,
    collection: TestCollection
) {
    const relevantFiles = await getTestfileDescendants(
        collection.rootDirectory
    );
    let currentPaths: PathWithChildren[] = relevantFiles.map((path) => ({
        path: path.fsPath,
        childItems: [],
    }));
    let currentTestItems: vscodeTestItem[];

    while (currentPaths.length > 0) {
        currentTestItems = [];

        currentPaths.forEach(({ path, childItems }) => {
            const isFile = lstatSync(path).isFile();
            let testItem: vscodeTestItem | undefined;

            if (!isFile) {
                testItem = Array.from(collection.testData.keys()).find(
                    (item) => item.uri?.fsPath == path
                );

                if (!testItem) {
                    testItem = addTestItem(
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
                    testItem = addTestItem(
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
    currentTestItems: vscodeTestItem[]
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
