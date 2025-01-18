import { Uri as vsCodeUri } from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { TestFile } from "./model/testFile";
import { TestCollection } from "./model/testCollection";
import { resolve } from "path";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const getSortText = (testFile: TestFile) =>
    new Array(testFile.sequence + 1).join("a");

export const getFullNameForTestReport = (testFile: TestFile) => {
    const fileName = testFile.path.split(new RegExp("(/|\\)")).slice(-2)[0];
    return testFile.path.replace(fileName, testFile.name);
}

export const getTestId = (uri: vsCodeUri) => uri.toString();

export const getTestLabel = (uri: vsCodeUri) => uri.path.split("/").pop()!;

export const getCollectionForTest = (
    testUri: vsCodeUri,
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
