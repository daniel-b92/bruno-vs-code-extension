import { TestController, Uri, TestItem as vscodeTestItem } from "vscode";
import { TestCollection } from "../model/testCollection";
import { addTestItem } from "./addTestItem";
import { TestDirectory } from "../model/testDirectory";
import { dirname } from "path";

export const createOrUpdateParentItem = (
    controller: TestController,
    childItem: vscodeTestItem,
    collection: TestCollection
) => {
    const existingParentItem = getParentItem(childItem.uri!, collection);
    if (existingParentItem) {
        existingParentItem.children.add(childItem);
        return existingParentItem;
    }

    const newParentItem = addTestItem(
        controller,
        collection,
        new TestDirectory(dirname(childItem.uri?.fsPath!))
    );
    newParentItem.children.add(childItem);

    return newParentItem;
};

export const getParentItem = (uri: Uri, collection: TestCollection) =>
    Array.from(collection.testDescendants.keys()).find(
        (item) => item.uri?.fsPath == dirname(uri.fsPath)
    );
