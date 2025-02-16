import { Uri as vsCodeUri } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { basename } from "path";

export const getTestId = (uri: vsCodeUri) => uri.toString();

export const getTestLabel = (uri: vsCodeUri) => basename(uri.fsPath);

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
