import {
    Collection,
    CollectionData,
    TestRunnerDataHelper,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
    BrunoRequestFile,
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
    const { item: newItem } = newData;

    const isSequenceOutdated =
        isCollectionItemWithSequence(newItem) &&
        isCollectionItemWithSequence(alreadyRegisteredItem) &&
        alreadyRegisteredItem.getSequence() != newItem.getSequence();

    if (!isRequestFile(alreadyRegisteredItem) || !isRequestFile(newItem)) {
        return isSequenceOutdated;
    }

    if (isSequenceOutdated || areTagsOutdated(alreadyRegisteredItem, newItem)) {
        collection.removeTestItemIfRegistered(alreadyRegisteredItem.getPath());
        collection.addItem(newData);
    }
}

function areTagsOutdated(
    alreadyRegisteredItem: BrunoRequestFile,
    newItem: BrunoRequestFile,
) {
    const newItemTags = newItem.getTags();
    const oldItemTags = alreadyRegisteredItem.getTags();

    if (newItemTags === undefined || oldItemTags === undefined) {
        return newItemTags === undefined && oldItemTags === undefined;
    }

    return (
        newItemTags.length == oldItemTags.length &&
        newItemTags.every((t) => oldItemTags.includes(t))
    );
}
