import {
    Collection,
    CollectionData,
    TestRunnerDataHelper,
    CollectionItem,
    isCollectionItemWithSequence,
} from "../..";
import { BrunoTreeItem } from "../../../treeView/brunoTreeItem";

export function addItemToCollection(
    testRunnerDataHelper: TestRunnerDataHelper,
    collection: Collection,
    item: CollectionItem,
) {
    const data: CollectionData = {
        item,
        treeItem: new BrunoTreeItem(
            item.getPath(),
            item.isFile(),
            isCollectionItemWithSequence(item) ? item.getSequence() : undefined,
        ),
        testItem: testRunnerDataHelper.createVsCodeTestItem(item),
    };

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        item.getPath(),
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
    } else if (
        registeredDataWithSamePath &&
        isCollectionItemWithSequence(item) &&
        isCollectionItemWithSequence(registeredDataWithSamePath.item) &&
        registeredDataWithSamePath.item.getSequence() != item.getSequence()
    ) {
        collection.removeTestItemIfRegistered(
            registeredDataWithSamePath.item.getPath(),
        );
        collection.addItem(data);
    }

    return data;
}
