import { TestFile } from "../model/testFile";
import { TestDirectory } from "../model/testDirectory";
import { TestCollection } from "../model/testCollection";
import { dirname } from "path";
import { getSortText, getTestId, getTestLabel } from "../testTreeHelper";
import { TestController, Uri } from "vscode";

export const addTestItem = (
    controller: TestController,
    collection: TestCollection,
    item: TestFile | TestDirectory
) => {
    const uri = Uri.file(item.path);
    const vsCodeItem = controller.createTestItem(
        getTestId(uri),
        getTestLabel(uri),
        uri
    );

    if (item instanceof TestFile) {
        vsCodeItem.canResolveChildren = false;
        vsCodeItem.sortText = getSortText(item);
    } else {
        vsCodeItem.canResolveChildren = true;
    }

    controller.items.add(vsCodeItem);
    const parentItem = Array.from(collection.testDescendants.keys()).find(
        (existingItem) => dirname(item.path) == existingItem.uri?.fsPath
    );
    if (parentItem) {
        parentItem.children.add(vsCodeItem);
    }

    collection.testDescendants.set(vsCodeItem, item);
    return vsCodeItem;
};
