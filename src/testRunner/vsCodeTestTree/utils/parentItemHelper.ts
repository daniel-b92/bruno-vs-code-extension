import { TestController, Uri, TestItem as vscodeTestItem } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { addTestItem } from "../testItemAdding/addTestItem";
import { TestDirectory } from "../../testData/testDirectory";
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

    if (childItem.uri == undefined) {
        throw new Error(
            `Provided child item does not have a URI: ${JSON.stringify(
                childItem,
                null,
                2
            )}`
        );
    }
    const newParentItem = addTestItem(
        controller,
        collection,
        new TestDirectory(dirname(childItem.uri.fsPath))
    );
    newParentItem.children.add(childItem);

    return newParentItem;
};

export const getParentItem = (uri: Uri, collection: TestCollection) =>
    collection.getTestItemForPath(dirname(uri.fsPath));
