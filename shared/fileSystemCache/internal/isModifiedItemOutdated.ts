import {
    AdditionalCollectionDataProvider,
    BrunoRequestFile,
    CollectionData,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";

export interface OutdatedPropertyDetails {
    sequenceOutdated: boolean;
    additionalDataOutdated: boolean;
    tagsOutdated: boolean;
}

export function isModifiedItemOutdated<T>(
    alreadyRegisteredData: CollectionData<T>,
    newData: CollectionData<T>,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
): { isOutdated: boolean; details: OutdatedPropertyDetails } {
    const { item: oldItem } = alreadyRegisteredData;
    const { item: newItem } = newData;

    const isSequenceOutdated =
        isCollectionItemWithSequence(newItem) &&
        isCollectionItemWithSequence(oldItem) &&
        oldItem.getSequence() != newItem.getSequence();

    const areTagsOutdated =
        isRequestFile(oldItem) &&
        isRequestFile(newItem) &&
        !areTagsUpToDate(oldItem, newItem);

    const isOutdatedDueToAdditionaData =
        additionalDataProvider.isAdditionalDataOutdated(
            alreadyRegisteredData.additionalData,
            newData.additionalData,
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
