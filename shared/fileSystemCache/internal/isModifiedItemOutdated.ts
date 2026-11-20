import {
    AdditionalCollectionDataProvider,
    isCollectionDirectory,
    CollectionItemWithTags,
    CollectionData,
    isCollectionItemWithSequence,
    isCollectionItemWithTags,
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
        isCollectionItemWithTags(oldItem) &&
        isCollectionItemWithTags(newItem) &&
        !areTagsUpToDate(oldItem, newItem);

    // The settings file path is stored in the item itself, so the item needs to be replaced if it changes (e.g. if the settings file was added or deleted).
    // The additional data of the item is replaced together with it, so this is reported as outdated additional data.
    const isOutdatedDueToAdditionaData =
        additionalDataProvider.isAdditionalDataOutdated(
            alreadyRegisteredData.additionalData,
            newData.additionalData,
        ) ||
        (isCollectionDirectory(oldItem) &&
            isCollectionDirectory(newItem) &&
            oldItem.getSettingsFilePath() != newItem.getSettingsFilePath());

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
    alreadyRegisteredItem: CollectionItemWithTags,
    newItem: CollectionItemWithTags,
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
