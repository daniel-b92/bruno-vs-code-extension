import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";
import { TestCollection } from "./model/testCollection";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

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
