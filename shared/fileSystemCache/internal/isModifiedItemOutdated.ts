import {
    AdditionalCollectionDataProvider,
    AdditionalCollectionDataProviderType,
    BrunoRequestFile,
    CollectionData,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";

export interface OutdatedPropertyDetails {
    sequenceOutdated: boolean;
    additionalDataOutdated: boolean;
    tagsOutdated?: boolean;
}

export function isModifiedItemOutdated<T>(
    alreadyRegisteredData: CollectionData<T>,
    newData: CollectionData<T>,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
): { isOutdated: boolean; details?: OutdatedPropertyDetails } {
    const { item: oldItem } = alreadyRegisteredData;
    const { item: newItem } = newData;

    if (oldItem.getItemType() != newItem.getItemType()) {
        return { isOutdated: true };
    }

    const isSequenceOutdated =
        isCollectionItemWithSequence(newItem) &&
        isCollectionItemWithSequence(oldItem) &&
        oldItem.getSequence() != newItem.getSequence();

    const areTagsOutdated =
        isRequestFile(oldItem) &&
        isRequestFile(newItem) &&
        !areTagsUpToDate(oldItem, newItem);

    const isOutdatedDueToAdditionaData = !isAdditionalDataUpToDate(
        alreadyRegisteredData.additionalData,
        newData.additionalData,
        additionalDataProvider,
    );

    return {
        isOutdated:
            isSequenceOutdated ||
            areTagsOutdated ||
            isOutdatedDueToAdditionaData,
        details: {
            sequenceOutdated: isSequenceOutdated,
            tagsOutdated: areTagsOutdated,
            additionalDataOutdated: isOutdatedDueToAdditionaData,
        },
    };
}

function isAdditionalDataUpToDate<T>(
    oldData: T,
    newData: T,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
) {
    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderType.SimpleCollectionItem
    ) {
        // For the simple collection item provider type, the additional data only depends on the item.
        // So the additional data cannot be outdated while the item isn't.
        return true;
    }

    const { isAdditionalDataOutdated } = additionalDataProvider;
    return isAdditionalDataOutdated(oldData, newData);
}

function areTagsUpToDate(
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
