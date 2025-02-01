import { TestController, Uri, TestItem as vscodeTestItem } from "vscode";
import { TestCollection } from "../../model/testCollection";
import { getSequence } from "../../fileSystem/testFileParser";
import { TestFile } from "../../model/testFile";
import { addTestItem } from "../testItemAdding/addTestItem";
import { createOrUpdateParentItem } from "../utils/parentItemHelper";
import { handleTestItemDeletion } from "./handleTestItemDeletion";

export function handleTestFileCreationOrUpdate(
    ctrl: TestController,
    collection: TestCollection,
    uri: Uri
) {
    const maybeFile = getOrCreateFile(ctrl, uri, collection);

    if (!maybeFile) {
        handleTestItemDeletion(ctrl, collection, uri);
    }
}

function getOrCreateFile(
    controller: TestController,
    uri: Uri,
    collection: TestCollection
) {
    const filePath = uri.fsPath!;
    const sequence = getSequence(filePath);

    if (!sequence) {
        return undefined;
    }

    const existing = collection.getTestItemForPath(uri.fsPath);
    if (existing) {
        return updateExistingTestFile(controller, existing, collection);
    }

    const testFile = new TestFile(filePath, sequence);
    const testItem = addTestItem(controller, collection, testFile);

    createOrUpdateParentItem(controller, testItem, collection);

    return { testItem, testFile };
}

function updateExistingTestFile(
    controller: TestController,
    item: vscodeTestItem,
    collection: TestCollection
) {
    const testFile = (
        collection.testData.get(item) as TestFile
    ).updateSequenceFromDisk();

    const testItem = addTestItem(controller, collection, testFile);
    createOrUpdateParentItem(controller, testItem, collection);

    return { testItem, testFile };
}
