import { Collection, CollectionData, CollectionItem } from "../..";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";

export function addItemToCollection<T>(
    collection: Collection<T>,
    item: CollectionItem,
    additionalDataCreator: (item: CollectionItem) => T,
) {
    const data: CollectionData<T> = {
        item,
        additionalData: additionalDataCreator(item),
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

function handleAlreadyRegisteredItemWithSamePath<T>(
    collection: Collection<T>,
    { item: alreadyRegisteredItem }: CollectionData<T>,
    newData: CollectionData<T>,
) {
    if (
        isModifiedItemOutdated(alreadyRegisteredItem, newData.item).isOutdated
    ) {
        collection.removeTestItemIfRegistered(alreadyRegisteredItem.getPath());
        collection.addItem(newData);
    }
}
