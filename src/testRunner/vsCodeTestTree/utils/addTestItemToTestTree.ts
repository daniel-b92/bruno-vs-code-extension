import { TestController, TestItem, Uri } from "vscode";
import { Collection } from "../../../shared/state/model/collection";
import { dirname } from "path";

export function addTestItemToTestTree(
    controller: TestController,
    collection: Collection,
    testItem: TestItem
) {
    controller.items.add(testItem);

    const maybeRegisteredParent = collection.getStoredDataForPath(
        dirname((testItem.uri as Uri).fsPath)
    );

    if (maybeRegisteredParent && maybeRegisteredParent.testItem) {
        maybeRegisteredParent.testItem.children.add(testItem);
    }
}
