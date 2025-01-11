import { readdirSync } from "fs";
import { dirname, extname } from "path";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const testData = new Map<vscode.TestItem, BrunoTestData>();

export const getTestfilesForCollection = async (collectionRootDir: string) => {
    return await vscode.workspace.findFiles(
        new vscode.RelativePattern(collectionRootDir, globPatternForTestfiles)
    );
};

export const getSortText = (testFile: TestFile) => new Array(testFile.sequence + 1).join("a");

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
