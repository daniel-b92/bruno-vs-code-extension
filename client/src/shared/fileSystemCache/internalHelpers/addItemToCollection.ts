import {
    Collection,
    CollectionData,
    TestRunnerDataHelper,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";
import { BrunoTreeItem } from "../../../treeView/brunoTreeItem";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";

export function addItemToCollection(
    testRunnerDataHelper: TestRunnerDataHelper,
    collection: Collection,
    item: CollectionItem,
) {
    const isItemWithSequence = isCollectionItemWithSequence(item);
    const data: CollectionData = {
        item,
        treeItem: new BrunoTreeItem(
            item.getPath(),
            item.isFile(),
            isItemWithSequence ? item.getSequence() : undefined,
            isRequestFile(item) ? item.getTags() : undefined,
        ),
        testItem: testRunnerDataHelper.createVsCodeTestItem(item),
    };

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        item.getPath(),
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
        return data;
    }

    handleAlreadyRegisteredItemWithSamePath(
        collection,
        registeredDataWithSamePath,
        data,
    );
    return data;
}

function handleAlreadyRegisteredItemWithSamePath(
    collection: Collection,
    { item: alreadyRegisteredItem }: CollectionData,
    newData: CollectionData,
) {
    if (
        isModifiedItemOutdated(alreadyRegisteredItem, newData.item).isOutdated
    ) {
        collection.removeTestItemIfRegistered(alreadyRegisteredItem.getPath());
        collection.addItem(newData);
    }
}
