import { TestController, Uri } from "vscode";
import { TestCollection } from "../model/testCollection";
import { getTestId } from "../testTreeHelper";
import { getParentItem } from "./parentItemHelper";
import { dirname } from "path";
import { existsSync } from "fs";

export const handleTestItemDeletion = (
    controller: TestController,
    collection: TestCollection,
    uri: Uri
) => {
    deleteSingleTestItem(controller, collection, uri);

    let currentPath = uri.fsPath;

    while (
        !existsSync(dirname(currentPath)) &&
        currentPath != collection.rootDirectory
    ) {
        deleteSingleTestItem(controller, collection, Uri.file(currentPath));
        currentPath = dirname(currentPath);
    }
};

const deleteSingleTestItem = (
    controller: TestController,
    collection: TestCollection,
    uri: Uri
) => {
    controller.items.delete(getTestId(uri));

    const keyToDelete = Array.from(collection.testData.keys()).find(
        (item) => item.uri?.fsPath == uri.fsPath
    );
    if (keyToDelete) {
        collection.testData.delete(keyToDelete);
    }

    const parentItem = getParentItem(Uri.file(uri.fsPath), collection);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
    }
};
