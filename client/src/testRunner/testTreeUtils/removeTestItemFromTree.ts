import { TestController, TestItemCollection, Uri } from "vscode";
import { dirname } from "path";
import { TypedCollection } from "@shared";
import { getTestId } from "./testTreeHelper";

/**
 * Removes the test item with the given URI from the test tree.
 *
 * Afterwards, all ancestor directories (except for the collection root) that do not have any test items left are removed as well.
 * This mirrors the structure of a freshly built test tree, which only contains directories with tests.
 *
 * Whether the item is still registered in the collection cache does not matter. It is not required that the item exists in the tree.
 */
export function removeTestItemFromTree(
    controller: TestController,
    collection: TypedCollection,
    itemUri: Uri,
) {
    let currentUri = itemUri;

    for (;;) {
        const parentData = collection.getStoredDataForPath(
            dirname(currentUri.fsPath),
        );
        getSiblings(controller, collection, currentUri).delete(
            getTestId(currentUri),
        );

        if (!parentData || collection.isRootDirectory(parentData.item.getPath())) {
            return;
        }

        const parentUri = parentData.additionalData.testItem.uri as Uri;
        // The cache could contain a different instance than the tree, so the actual item in the tree is checked.
        const parentItemInTree = getSiblings(
            controller,
            collection,
            parentUri,
        ).get(getTestId(parentUri));

        if (!parentItemInTree || parentItemInTree.children.size > 0) {
            return;
        }

        currentUri = parentUri;
    }
}

function getSiblings(
    controller: TestController,
    collection: TypedCollection,
    uri: Uri,
): TestItemCollection {
    const maybeParent = collection.getStoredDataForPath(dirname(uri.fsPath));

    return maybeParent
        ? maybeParent.additionalData.testItem.children
        : controller.items;
}

