import {
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    getItemType,
    getAdditionalCollectionData,
} from "../..";
import { getCollectionItem } from "./getCollectionItem";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";
import { FileSystemData } from "./interfaces";
import { getFileSystemDataPath } from "./fileSystemDataUtils";

export async function addOrReplaceItemInCollection<T>(newItem: {
    fileSystemData: FileSystemData;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}) {
    const { additionalDataProvider, collection, fileSystemData } = newItem;

    const data = await getCollectionData({
        fileSystemData,
        collection,
        additionalDataProvider,
    });

    if (!data) {
        return undefined;
    }

    return addOrReplaceCollectionData({
        additionalDataProvider,
        collection,
        data,
    });
}

export function addOrReplaceCollectionData<T>(newItem: {
    data: CollectionData<T>;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}) {
    const { additionalDataProvider, collection, data } = newItem;

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        data.item.getPath(),
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
        return data;
    }

    handleAlreadyRegisteredItemWithSamePath(
        collection,
        registeredDataWithSamePath,
        data,
        additionalDataProvider,
    );
    return data;
}

async function getCollectionData<T>(params: {
    fileSystemData: FileSystemData;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}): Promise<CollectionData<T> | undefined> {
    const { additionalDataProvider, collection, fileSystemData } = params;
    // Skip validation if path exists, since should already have been done earlier.
    // This would also take up extra time, when calling this function multiple times for many items.
    const itemType = await getItemType(collection, fileSystemData, false);

    const path = getFileSystemDataPath(fileSystemData);

    const item = itemType
        ? await getCollectionItem(collection, {
              path,
              itemType,
          })
        : undefined;

    if (!item) {
        return undefined;
    }

    return {
        item,
        additionalData: await getAdditionalCollectionData(
            item,
            additionalDataProvider,
            collection.isRootDirectory(item.getPath()),
            collection.getFormat(),
        ),
    };
}

function handleAlreadyRegisteredItemWithSamePath<T>(
    collection: Collection<T>,
    oldData: CollectionData<T>,
    newData: CollectionData<T>,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
) {
    if (isModifiedItemOutdated(oldData, newData, additionalDataProvider)) {
        collection.removeTestItemIfRegistered(oldData.item.getPath());
        collection.addItem(newData);
    }
}
