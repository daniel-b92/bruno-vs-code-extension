import {
    AdditionalCollectionDataProviderType,
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    getItemType,
    parseFileByPath,
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

    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderType.SimpleCollectionItem
    ) {
        return {
            item,
            additionalData: additionalDataProvider.callback(
                item,
                collection.isRootDirectory(item.getPath()),
            ),
        };
    }

    const {
        callbacksForItemsRequiringFullParsing: {
            getData,
            getFilePathForParsing,
        },
        callbackForOtherItems,
        itemTypesRequiringFullFileParsing,
    } = additionalDataProvider;

    if (itemTypesRequiringFullFileParsing.includes(item.getItemType())) {
        const toParse = getFilePathForParsing(item);
        return {
            item,
            additionalData: getData(
                toParse ? await parseFileByPath(toParse) : undefined,
            ),
        };
    }

    return { item, additionalData: callbackForOtherItems(item) };
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
