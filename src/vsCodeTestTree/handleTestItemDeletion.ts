import { EventEmitter, TestController, Uri } from "vscode";
import { TestCollection } from "../model/testCollection";
import { getTestId } from "../testTreeHelper";
import { getParentItem } from "./parentItemHelper";
import { dirname } from "path";
import { existsSync } from "fs";

export const handleTestItemDeletion = (
    controller: TestController,
    collection: TestCollection,
    fileChangedEmitter: EventEmitter<Uri>,
    uri: Uri
) => {
    deleteSingleTestItem(controller, collection, fileChangedEmitter, uri);

    let currentPath = uri.fsPath;

    while (
        !existsSync(dirname(currentPath)) &&
        currentPath != collection.rootDirectory
    ) {
        deleteSingleTestItem(
            controller,
            collection,
            fileChangedEmitter,
            Uri.file(currentPath)
        );
        currentPath = dirname(currentPath);
    }
};

const deleteSingleTestItem = (
    controller: TestController,
    collection: TestCollection,
    fileChangedEmitter: EventEmitter<Uri>,
    uri: Uri
) => {
    controller.items.delete(getTestId(uri));
    fileChangedEmitter.fire(uri);

    const keyToDelete = Array.from(collection.testData.keys()).find(
        (item) => item.uri?.fsPath == uri.fsPath
    );
    if (keyToDelete) {
        collection.testData.delete(keyToDelete);
    }

    const parentItem = getParentItem(Uri.file(uri.fsPath), collection);
    if (parentItem) {
        parentItem.children.delete(getTestId(uri));
        fileChangedEmitter.fire(parentItem.uri!);
    }
};
