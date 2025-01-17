import { lstatSync } from "fs";
import { dirname } from "path";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";
import { getSequence } from "./parser";
import { TestCollection } from "./model/testCollection";
import { addTestItem } from "./vsCodeTestTree/addTestItem";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const getTestfileDescendants = async (directoryPath: string) => {
    const bruFileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(directoryPath, globPatternForTestfiles)
    );
    return bruFileUris.filter((uri) => getSequence(uri.fsPath) != undefined);
};

export const getSortText = (testFile: TestFile) =>
    new Array(testFile.sequence + 1).join("a");

export const getTestId = (uri: vscode.Uri) => uri.toString();

export const getTestLabel = (uri: vscode.Uri) => uri.path.split("/").pop()!;

export const getCollectionForTest = (
    testUri: vscode.Uri,
    testCollections: TestCollection[]
) => {
    const collection = testCollections.find((collection) =>
        testUri.fsPath.includes(collection.rootDirectory)
    );
    if (collection == undefined) {
        throw new Error(
            `Could not find collection for test URI ${JSON.stringify(
                testUri,
                null,
                2
            )}`
        );
    }
    return collection;
};

export async function addAllTestitemsToTestTree(
    controller: vscode.TestController,
    collection: TestCollection
) {
    type PathWithChildren = {
        path: string;
        childItems: vscode.TestItem[];
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
                    childItems:
                        result[arrayIndex].childItems.concat(childItems),
                };
            }
        });

        return result;
    };

    const switchToParentDirectory = (
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

        currentPaths = switchToParentDirectory(currentPaths, currentTestItems);
    }
}
