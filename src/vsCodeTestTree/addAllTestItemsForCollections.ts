import { TestCollection } from "../model/testCollection";
import { dirname } from "path";
import { addTestItem } from "./addTestItem";
import { TestDirectory } from "../model/testDirectory";
import { getSequence } from "../fileSystem/testFileParser";
import { TestFile } from "../model/testFile";
import { getTestFileDescendants } from "../fileSystem/getTestFileDescendants";
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
    const relevantFiles = await getTestFileDescendants(
        collection.rootDirectory
    );
    const testFileItems = addItemsForTestFiles(
        controller,
        collection,
        relevantFiles
    );

    let currentPaths = switchToParentDirectory(
        collection,
        relevantFiles.map((path) => ({
            path: path.fsPath,
            childItems: [],
        })),
        testFileItems
    );

    while (currentPaths.length > 0) {
        const currentTestItems: vscodeTestItem[] = [];

        currentPaths.forEach(({ path, childItems }) => {
            const maybeExistingTestItem = Array.from(
                collection.testData.keys()
            ).find((item) => item.uri?.fsPath == path);

            const testItem = maybeExistingTestItem
                ? maybeExistingTestItem
                : addTestItem(
                      controller,
                      collection,
                      new TestDirectory(path) // test files should not be relevant after switching to the parent directory at least once
                  );

            childItems.forEach((childItem) =>
                testItem!.children.add(childItem)
            );
            currentTestItems.push(testItem);
        });

        currentPaths = switchToParentDirectory(
            collection,
            currentPaths,
            currentTestItems
        );
    }
}

const addItemsForTestFiles = (
    controller: TestController,
    collection: TestCollection,
    testFiles: Uri[]
) => {
    const result: vscodeTestItem[] = [];

    testFiles
        .map((uri) => ({
            path: uri.fsPath,
            childItems: [],
        }))
        .forEach(({ path }) => {
            const sequence = getSequence(path);
            if (sequence) {
                const testItem = addTestItem(
                    controller,
                    collection,
                    new TestFile(path, sequence)
                );
                result.push(testItem);
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
