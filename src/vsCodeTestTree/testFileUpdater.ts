import { EventEmitter, TestController, Uri } from "vscode";
import { TestCollection } from "../model/testCollection";
import { getSequence } from "../fileSystem/parser";
import { TestFile } from "../model/testFile";
import { addTestItem } from "./addTestItem";
import { createOrUpdateParentItem } from "./parentItemHelper";
import { dirname } from "path";
import { handleTestItemDeletion } from "./handleTestItemDeletion";

export function handleTestFileCreationOrUpdate(
    ctrl: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    collection: TestCollection,
    uri: Uri
) {
    const maybeFile = getOrCreateFile(ctrl, uri, collection);

    if (!maybeFile) {
        handleTestItemDeletion(ctrl, collection, fileChangedEmitter, uri);
    } else {
        maybeFile.testFile.updateFromDisk(maybeFile.testItem, collection);
        let currentItem = maybeFile.testItem;

        while (collection.rootDirectory != currentItem.uri?.fsPath) {
            currentItem = createOrUpdateParentItem(
                ctrl,
                currentItem,
                collection
            );
            fileChangedEmitter.fire(currentItem.uri!);
        }

        fileChangedEmitter.fire(uri);
    }
}

export function getOrCreateFile(
    controller: TestController,
    uri: Uri,
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

    const testFile = new TestFile(filePath, sequence);
    const testItem = addTestItem(controller, collection, testFile);

    const parentItem = Array.from(collection.testData.keys()).find(
        (item) => dirname(filePath) == item.uri?.fsPath
    );
    if (parentItem) {
        parentItem.children.add(testItem);
    }

    return { testItem, testFile };
}
