import { EventEmitter, TestController, Uri } from "vscode";
import { TestCollection } from "../../model/testCollection";
import { getSequence } from "../../fileSystem/testFileParser";
import { TestFile } from "../../model/testFile";
import { addTestItem } from "../testItemAdding/addTestItem";
import { createOrUpdateParentItem } from "../utils/parentItemHelper";
import { dirname } from "path";
import { handleTestItemDeletion } from "./handleTestItemDeletion";

export function handleTestFileCreationOrUpdate(
    ctrl: TestController,
    collection: TestCollection,
    uri: Uri
) {
    const maybeFile = getOrCreateFile(ctrl, uri, collection);

    if (!maybeFile) {
        handleTestItemDeletion(ctrl, collection, uri);
    } else {
        maybeFile.testFile.updateFromDisk(maybeFile.testItem, collection);
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
        return {
            testItem: existing,
            testFile: collection.testData.get(existing) as TestFile,
        };
    }

    const testFile = new TestFile(filePath, sequence);
    const testItem = addTestItem(controller, collection, testFile);

    const parentItem = collection.getTestItemForPath(dirname(filePath));
    if (parentItem) {
        parentItem.children.add(testItem);
    }

    return { testItem, testFile };
}
