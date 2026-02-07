import {
    BrunoRequestFile,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
} from "@global_shared";

export interface OutdatedPropertyDetails {
    sequenceOutdated: boolean;
    tagsOutdated?: boolean;
}

export function isModifiedItemOutdated(
    alreadyRegisteredItem: CollectionItem,
    newItem: CollectionItem,
): { isOutdated: boolean; details: OutdatedPropertyDetails } {
    const isSequenceOutdated =
        isCollectionItemWithSequence(newItem) &&
        isCollectionItemWithSequence(alreadyRegisteredItem) &&
        alreadyRegisteredItem.getSequence() != newItem.getSequence();

    if (!isRequestFile(alreadyRegisteredItem) || !isRequestFile(newItem)) {
        return {
            isOutdated: isSequenceOutdated,
            details: { sequenceOutdated: isSequenceOutdated },
        };
    }

    const areTagsOutdated = !areTagsUpToDate(alreadyRegisteredItem, newItem);

    return {
        isOutdated: isSequenceOutdated || areTagsOutdated,
        details: {
            sequenceOutdated: isSequenceOutdated,
            tagsOutdated: areTagsOutdated,
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
