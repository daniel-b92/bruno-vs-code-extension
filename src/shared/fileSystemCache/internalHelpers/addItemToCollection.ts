import {
    Collection,
    CollectionData,
    TestRunnerDataHelper,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";
import { BrunoTreeItem } from "../../../treeView/brunoTreeItem";

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

    const { item: registeredItem } = registeredDataWithSamePath;

    const isSequenceOutdated =
        registeredDataWithSamePath &&
        isCollectionItemWithSequence(item) &&
        isCollectionItemWithSequence(registeredItem) &&
        registeredItem.getSequence() != item.getSequence();

    if (isSequenceOutdated || areTagsOutdated(registeredItem, item)) {
        collection.removeTestItemIfRegistered(
            registeredDataWithSamePath.item.getPath(),
        );
        collection.addItem(data);
    }

    return data;
}

function areTagsOutdated(oldItem: CollectionItem, newItem: CollectionItem) {
    if (!isRequestFile(oldItem) || !isRequestFile(newItem)) {
        return false;
    }

    const newItemTags = newItem.getTags();
    const oldItemTags = oldItem.getTags();

    if (newItemTags === undefined || oldItemTags === undefined) {
        return newItemTags === undefined && oldItemTags === undefined;
    }

    return (
        newItemTags.length == oldItemTags.length &&
        newItemTags.every((t) => oldItemTags.includes(t))
    );
}
