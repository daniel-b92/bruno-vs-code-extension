import { lstatSync, readdirSync } from "fs";
import { dirname, extname } from "path";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";
import { getSequence } from "./parser";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const testData = new Map<vscode.TestItem, BrunoTestData>();

export const getTestfileDescendants = async (directoryPath: string) => {
    return await vscode.workspace.findFiles(
        new vscode.RelativePattern(directoryPath, globPatternForTestfiles)
    );
};

export const getSortText = (testFile: TestFile) =>
    new Array(testFile.sequence + 1).join("a");

export const getTestId = (uri: vscode.Uri) => uri.toString();

export const getTestLabel = (uri: vscode.Uri) => uri.path.split("/").pop()!;

export const isCollectionRootDir = (path: string) =>
    extname(path) == "" &&
    readdirSync(path).some((file) => file.endsWith("bruno.json"));

export const getCollectionRootDir = (testFilePath: string) => {
    let currentPath = testFilePath;

    while (!isCollectionRootDir(currentPath)) {
        currentPath = dirname(currentPath);
    }

    return currentPath;
};

export const updateParentItem = (childItem: vscode.TestItem) => {
    const parentItem = getParentItem(childItem.uri!);
    if (parentItem) {
        parentItem.children.add(childItem);
    }
    return parentItem;
};

export const getParentItem = (uri: vscode.Uri) =>
    Array.from(testData.keys()).find(
        (item) => item.uri?.fsPath == dirname(uri.fsPath)
    );

export function updateNodeForDocument(
    ctrl: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
    e: vscode.TextDocument
) {
    if (e.uri.scheme !== "file" || !e.uri.path.endsWith(".bru")) {
        return;
    }

    const maybeFile = getOrCreateFile(ctrl, e.uri);
    if (maybeFile) {
        maybeFile.testFile.updateFromDisk(maybeFile.testItem);
    } else {
        removeTestFile(ctrl, fileChangedEmitter, e.uri);
    }
}

export function getOrCreateFile(
    controller: vscode.TestController,
    uri: vscode.Uri
) {
    const filePath = uri.fsPath!;
    const sequence = getSequence(filePath);

    if (!sequence) {
        return undefined;
    }

    const existing = Array.from(testData.keys()).find(
        (item) => item.uri?.fsPath == uri.fsPath
    );
    if (existing) {
        return {
            testItem: existing,
            testFile: testData.get(existing) as TestFile,
        };
    }

    const testItem = controller.createTestItem(
        getTestId(uri),
        getTestLabel(uri),
        uri
    );

    const testFile = new TestFile(filePath, sequence);

    testItem.canResolveChildren = false;
    testItem.sortText = getSortText(testFile);
    controller.items.add(testItem);
    const parentItem = Array.from(testData.keys()).find(
        (item) => dirname(filePath) == item.uri?.fsPath
    );
    if (parentItem) {
        parentItem.children.add(testItem);
    }

    testData.set(testItem, testFile);
    return { testItem, testFile };
}

export async function createAllTestitemsForCollection(
    controller: vscode.TestController,
    collectionRootDir: string
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
            .filter(({ path }) => path.includes(collectionRootDir));

        return getUniquePaths(parentsWithDuplicatePaths);
    };

    const relevantFiles = await getTestfileDescendants(
        collectionRootDir
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
                testItem = Array.from(testData.keys()).find(
                    (item) => item.uri?.fsPath == path
                );

                if (!testItem) {
                    testItem = controller.createTestItem(
                        getTestId(uri),
                        getTestLabel(uri),
                        uri
                    );
                    controller.items.add(testItem);
                    testItem.canResolveChildren = true;
                    const testDir = new TestDirectory(path);
                    testData.set(testItem, testDir);
                }

                childItems.forEach((childItem) =>
                    testItem!.children.add(childItem)
                );
            } else {
                const sequence = getSequence(path);
                if (sequence) {
                    testItem = controller.createTestItem(
                        getTestId(uri),
                        getTestLabel(uri),
                        uri
                    );
                    const testFile = new TestFile(path, sequence);
                    testItem.sortText = getSortText(testFile);
                    controller.items.add(testItem);
                    testData.set(testItem, testFile);
                }
            }
            if (testItem) {
                currentTestItems.push(testItem);
            }
        });

        currentPaths = switchToParentDirectory(currentPaths, currentTestItems);
    }
}

export const removeTestFile = (
    controller: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
    uri: vscode.Uri
) => {
    controller.items.delete(getTestId(uri));
    fileChangedEmitter.fire(uri);

    const parentItem = getParentItem(uri);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
        fileChangedEmitter.fire(parentItem.uri!);
    }
    const keyToDelete = Array.from(testData.keys()).find(
        (item) => item.uri == uri
    );
    if (keyToDelete) {
        testData.delete(keyToDelete);
    }
};
