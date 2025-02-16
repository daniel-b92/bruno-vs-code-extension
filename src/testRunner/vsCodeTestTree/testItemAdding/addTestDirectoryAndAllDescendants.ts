import { TestCollection } from "../../testData/testCollection";
import { dirname } from "path";
import { addTestItem } from "./addTestItem";
import { TestDirectory } from "../../testData/testDirectory";
import { getSequence } from "../../../shared/fileSystem/testFileParser";
import { TestFile } from "../../testData/testFile";
import { getTestFileDescendants } from "../../../shared/fileSystem/getTestFileDescendants";
import { TestController, Uri, TestItem as vscodeTestItem } from "vscode";

interface PathWithChildren {
    path: string;
    childItems: vscodeTestItem[];
}

export async function addTestDirectoryAndAllDescendants(
    controller: TestController,
    collection: TestCollection,
    testDirectory: TestDirectory
) {
    const relevantFiles = await getTestFileDescendants(testDirectory.path);
    const testFileItems = addItemsForTestFiles(
        controller,
        collection,
        relevantFiles
    );

    let currentPaths = switchToParentDirsContainingAncestorPath(
        relevantFiles.map((path) => ({
            path: path.fsPath,
            childItems: [],
        })),
        testFileItems,
        testDirectory
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

        currentPaths = switchToParentDirsContainingAncestorPath(
            currentPaths,
            currentTestItems,
            testDirectory
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

const switchToParentDirsContainingAncestorPath = (
    pathsWithChildren: PathWithChildren[],
    currentTestItems: vscodeTestItem[],
    ancestorDirectory: TestDirectory
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
        .filter(({ path }) => path.includes(ancestorDirectory.path));

    return getUniquePaths(parentsWithDuplicatePaths);
};

const getUniquePaths = (arr: PathWithChildren[]) => {
    const result: PathWithChildren[] = [];

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
