import { readdirSync } from "fs";
import { dirname, extname } from "path";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";

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
