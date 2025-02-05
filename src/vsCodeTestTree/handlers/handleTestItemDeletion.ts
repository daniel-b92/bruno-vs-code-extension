import { TestController, Uri } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { getTestId } from "../../testTreeHelper";
import { getParentItem } from "../utils/parentItemHelper";

export const handleTestItemDeletion = (
    controller: TestController,
    collection: TestCollection,
    uri: Uri
) => {
    controller.items.delete(getTestId(uri));

    const keyToDelete = collection.getTestItemForPath(uri.fsPath);
    if (keyToDelete) {
        collection.testData.delete(keyToDelete);
    }

    const parentItem = getParentItem(Uri.file(uri.fsPath), collection);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
    }
};
