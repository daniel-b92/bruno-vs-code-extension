import { Uri as vsCodeUri } from "vscode";
import { TestDirectory } from "./testData/testDirectory";
import { TestFile } from "./testData/testFile";
import { TestCollection } from "./testData/testCollection";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const getSortText = (testFile: TestFile) =>
    new Array(testFile.getSequence() + 1).join("a");

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
