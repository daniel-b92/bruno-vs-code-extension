import { TestController, TestItem, Uri } from "vscode";
import {
    Collection,
    normalizeDirectoryPath,
    CollectionData,
    CollectionItem,
} from "../../shared";
import { dirname } from "path";
import { getTestId } from "./testTreeHelper";

export function addTestItemAndAncestorsToTestTree(
    controller: TestController,
    collection: Collection,
    item: CollectionItem
) {
    const data = collection.getStoredDataForPath(item.getPath());

    if (!data) {
        console.warn(
            `Could not add test item to test tree for data with path '${item.getPath()}'`
        );
        return;
    }

    addMissingAncestorItemsToTestTree(controller, collection, item);

    addTestItemToTestTreeOnTopLevel(controller, data.testItem);

    addTestItemToListOfChildrenFromParent(collection, data);
}

function addMissingAncestorItemsToTestTree(
    controller: TestController,
    collection: Collection,
    item: CollectionItem
) {
    const missingAncestors: CollectionData[] = [];

    const allAncestorsDescendingByPathLength = getAncestors(
        collection,
        item
    ).sort(
        ({ item: a }, { item: b }) => b.getPath().length - a.getPath().length
    );

    for (let i = 0; i < allAncestorsDescendingByPathLength.length - 1; i++) {
        const { item, testItem, treeItem } =
            allAncestorsDescendingByPathLength[i];

        if (!testItem) {
            console.warn(
                `Could not find test item for ancestor data with path '${item.getPath()}'`
            );
            break;
        }

        const { item: parentItem, testItem: parentTestItem } =
            allAncestorsDescendingByPathLength[i + 1];

        if (!parentTestItem) {
            console.warn(
                `Could not find test item for parent data with path '${parentItem.getPath()}'`
            );
            break;
        }

        if (
            parentTestItem.children.get(getTestId(testItem.uri as Uri)) ==
            undefined
        ) {
            missingAncestors.push({ item, treeItem, testItem });
        } else {
            break;
        }
    }

    for (const ancestor of missingAncestors.reverse()) {
        addTestItemToTestTreeOnTopLevel(controller, ancestor.testItem);
        addTestItemToListOfChildrenFromParent(collection, ancestor);
    }
}

function addTestItemToTestTreeOnTopLevel(
    controller: TestController,
    testItem: TestItem
) {
    controller.items.add(testItem);
}

function addTestItemToListOfChildrenFromParent(
    collection: Collection,
    data: CollectionData
) {
    const maybeRegisteredParent = collection.getStoredDataForPath(
        dirname(data.item.getPath())
    );

    if (maybeRegisteredParent) {
        maybeRegisteredParent.testItem.children.add(data.testItem);
    }
}

function getAncestors(collection: Collection, item: CollectionItem) {
    return collection.getAllStoredDataForCollection().filter(({ item: i }) => {
        const normalizedDescendantItemPath = normalizeDirectoryPath(
            item.getPath()
        );
        const normalizedStoredItemPath = normalizeDirectoryPath(i.getPath());

        return (
            normalizedDescendantItemPath.startsWith(normalizedStoredItemPath) &&
            normalizedStoredItemPath.length <
                normalizedDescendantItemPath.length
        );
    });
}
