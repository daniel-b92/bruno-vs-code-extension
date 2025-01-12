import { lstatSync, readdirSync } from "fs";
import { dirname, extname } from "path";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";
import { getSequence } from "./parser";
import { TestCollection } from "./model/testCollection";

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

export const getAllCollectionRootDirectories = async () =>
    (await vscode.workspace.findFiles("**/bruno.json"))
        .map((uri) => dirname(uri.fsPath))
        .filter((path) => isCollectionRootDir(path));

export const isCollectionRootDir = async (path: string) =>
    lstatSync(path).isDirectory() &&
    readdirSync(path).some((file) => file.endsWith("bruno.json")) &&
    (await getTestfileDescendants(path).then(
        (descendants) => descendants.length > 0
    ));

export const getCollectionRootDir = (testFilePath: string) => {
    let currentPath = testFilePath;

    while (!isCollectionRootDir(currentPath)) {
        currentPath = dirname(currentPath);
    }

    return currentPath;
};

export const updateParentItem = (
    childItem: vscode.TestItem,
    collection: TestCollection
) => {
    const parentItem = getParentItem(childItem.uri!, collection);
    if (parentItem) {
        parentItem.children.add(childItem);
    }
    return parentItem;
};

export const getParentItem = (uri: vscode.Uri, collection: TestCollection) =>
    Array.from(collection.testData.keys()).find(
        (item) => item.uri?.fsPath == dirname(uri.fsPath)
    );

export function updateNodeForDocument(
    ctrl: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
    e: vscode.TextDocument,
    allCollections: TestCollection[]
) {
    if (e.uri.scheme !== "file" || !e.uri.path.endsWith(".bru")) {
        return;
    }

    const collection = getCollectionForTest(e.uri, allCollections);
    const maybeFile = getOrCreateFile(ctrl, e.uri, collection);
    if (maybeFile) {
        maybeFile.testFile.updateFromDisk(maybeFile.testItem, collection);
    } else {
        removeTestFile(ctrl, fileChangedEmitter, e.uri, collection);
    }
}

export function getOrCreateFile(
    controller: vscode.TestController,
    uri: vscode.Uri,
    collection: TestCollection
) {
    const filePath = uri.fsPath!;
    const sequence = getSequence(filePath);

    if (!sequence) {
        return undefined;
    }

    const existing = Array.from(collection.testData.keys()).find(
        (item) => item.uri?.fsPath == uri.fsPath
    );
    if (existing) {
        return {
            testItem: existing,
            testFile: collection.testData.get(existing) as TestFile,
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
    const parentItem = Array.from(collection.testData.keys()).find(
        (item) => dirname(filePath) == item.uri?.fsPath
    );
    if (parentItem) {
        parentItem.children.add(testItem);
    }

    collection.testData.set(testItem, testFile);
    return { testItem, testFile };
}

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

    const relevantFiles = await getTestfileDescendants(collection.rootDirectory);
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
                    testItem = controller.createTestItem(
                        getTestId(uri),
                        getTestLabel(uri),
                        uri
                    );
                    controller.items.add(testItem);
                    testItem.canResolveChildren = true;
                    const testDir = new TestDirectory(path);
                    collection.testData.set(testItem, testDir);
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
                    collection.testData.set(testItem, testFile);
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
    uri: vscode.Uri,
    collection: TestCollection
) => {
    controller.items.delete(getTestId(uri));
    fileChangedEmitter.fire(uri);

    const parentItem = getParentItem(uri, collection);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
        fileChangedEmitter.fire(parentItem.uri!);
    }
    const keyToDelete = Array.from(collection.testData.keys()).find(
        (item) => item.uri == uri
    );
    if (keyToDelete) {
        collection.testData.delete(keyToDelete);
    }
};
