import { TestFile } from "../../testData/testFile";
import { TestDirectory } from "../../testData/testDirectory";
import { TestCollection } from "../../testData/testCollection";
import { dirname } from "path";
import { getSortText, getTestId, getTestLabel } from "../../testTreeHelper";
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
    const parentItem = collection.getTestItemForPath(dirname(item.path));
    if (parentItem) {
        parentItem.children.add(vsCodeItem);
    }

    collection.testData.set(vsCodeItem, item);
    return vsCodeItem;
};
