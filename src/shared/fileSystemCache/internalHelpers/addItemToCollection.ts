import {
    Collection,
    CollectionData,
    CollectionFile,
    CollectionItem,
    TestRunnerDataHelper,
} from "../..";
import { BrunoTreeItem } from "../../../client/explorer/brunoTreeItem";

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

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        item.getPath()
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
    } else if (
        registeredDataWithSamePath &&
        registeredDataWithSamePath.item.getSequence() != item.getSequence()
    ) {
        collection.removeTestItemIfRegistered(
            registeredDataWithSamePath.item.getPath()
        );
        collection.addItem(data);
    }

    return data;
}
