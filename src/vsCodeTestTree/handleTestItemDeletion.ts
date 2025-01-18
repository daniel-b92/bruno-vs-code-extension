import { EventEmitter, TestController, Uri } from "vscode";
import { TestCollection } from "../model/testCollection";
import { getTestId } from "../testTreeHelper";
import { getParentItem } from "./parentItemHelper";

export const handleTestItemDeletion = (
    controller: TestController,
    collection: TestCollection,
    fileChangedEmitter: EventEmitter<Uri>,
    uri: Uri
) => {
    controller.items.delete(getTestId(uri));
    fileChangedEmitter.fire(uri);

    const parentItem = getParentItem(uri, collection);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
        fileChangedEmitter.fire(parentItem.uri!);
    }
    const keyToDelete = Array.from(collection.testData.keys()).find(
        (item) => item.uri == uri
    );
    if (keyToDelete) {
        collection.testData.delete(keyToDelete);
    }
};
