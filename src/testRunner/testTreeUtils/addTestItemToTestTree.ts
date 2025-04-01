import { TestController, TestItem, Uri } from "vscode";
import { Collection } from "../../shared/state/model/collection";
import { dirname } from "path";
import { normalizeDirectoryPath } from "../../shared/fileSystem/util/normalizeDirectoryPath";

export function addTestItemToTestTree(
    controller: TestController,
    collection: Collection,
    testItem: TestItem
) {
    addAncestorItemsToTestTree(collection, testItem);

    controller.items.add(testItem);

    const maybeRegisteredParent = collection.getStoredDataForPath(
        dirname((testItem.uri as Uri).fsPath)
    );

    if (maybeRegisteredParent && maybeRegisteredParent.testItem) {
        maybeRegisteredParent.testItem.children.add(testItem);
    }
}

function addAncestorItemsToTestTree(
    collection: Collection,
    testItem: TestItem
) {
    for (const ancestor of getAncestors(collection, testItem)) {
        const maybeRegisteredParent = collection.getStoredDataForPath(
            dirname(ancestor.item.getPath())
        );

        if (maybeRegisteredParent && maybeRegisteredParent.testItem) {
            maybeRegisteredParent.testItem.children.add(testItem);
        }
    }
}

function getAncestors(collection: Collection, testItem: TestItem) {
    return collection.getAllStoredDataForCollection().filter(({ item: i }) => {
        const normalizedItemPath = normalizeDirectoryPath(
            (testItem.uri as Uri).fsPath
        );

        return (
            normalizedItemPath.startsWith(i.getPath()) &&
            normalizeDirectoryPath(i.getPath()).length <
                normalizedItemPath.length
        );
    });
}
