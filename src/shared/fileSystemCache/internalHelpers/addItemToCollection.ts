import {
    Collection,
    CollectionData,
    CollectionFile,
    CollectionItem,
    TestRunnerDataHelper,
} from "../..";
import { BrunoTreeItem } from "../../../treeView/brunoTreeItem";

export function addItemToCollection(
    testRunnerDataHelper: TestRunnerDataHelper,
    collection: Collection,
    item: CollectionItem
) {
    const isFile = item instanceof CollectionFile;

    const data: CollectionData = {
        item,
        treeItem: new BrunoTreeItem(item.getPath(), isFile, item.getSequence()),
        testItem: testRunnerDataHelper.createVsCodeTestItem(item),
    };

    collection.addItem(data);

    return data;
}
