import {
    AdditionalCollectionDataProviderType,
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    CollectionItem,
    CollectionItemWithBruVariables,
} from "../..";
import { getCollectionItem } from "./getCollectionItem";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";

export async function addItemToCollection<T>(params: {
    path: string;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}) {
    const { additionalDataProvider, collection, path } = params;

    const data = await getCollectionData({
        path,
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
    );
    return data;
}

async function getCollectionData<T>(params: {
    path: string;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}): Promise<CollectionData<T> | undefined> {
    const { additionalDataProvider, collection, path } = params;

    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderType.SimpleCollectionItem
    ) {
        const item = await getCollectionItem(collection, path, false);

        return item
            ? { item, additionalData: additionalDataProvider.callback(item) }
            : undefined;
    }

    const item = await getCollectionItem(collection, path, true);
    if (!item) {
        return undefined;
    }

    return doesItemSupportVariableReferences(item)
        ? {
              item,
              additionalData:
                  additionalDataProvider.callbackForItemsWithVariables(item),
          }
        : {
              item,
              additionalData:
                  additionalDataProvider.callbackForOtherItems(item),
          };
}

function doesItemSupportVariableReferences(
    item: CollectionItem,
): item is CollectionItemWithBruVariables {
    return "getVariableReferences" in item;
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
