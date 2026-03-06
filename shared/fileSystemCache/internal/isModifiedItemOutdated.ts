import {
    AdditionalCollectionDataProviderType,
    areVariableReferencesEquivalent,
    BrunoRequestFile,
    CollectionItem,
    isCollectionItemWithBruVariables,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";

export interface OutdatedPropertyDetails {
    sequenceOutdated: boolean;
    additionalDataOutdated: boolean;
    tagsOutdated?: boolean;
}

export function isModifiedItemOutdated(
    alreadyRegisteredItem: CollectionItem,
    newItem: CollectionItem,
    additionalDataProviderType: AdditionalCollectionDataProviderType,
): { isOutdated: boolean; details: OutdatedPropertyDetails } {
    const isSequenceOutdated =
        isCollectionItemWithSequence(newItem) &&
        isCollectionItemWithSequence(alreadyRegisteredItem) &&
        alreadyRegisteredItem.getSequence() != newItem.getSequence();

    const isOutdatedDueToAdditionaData = !isAdditionalDataUpToDate(
        alreadyRegisteredItem,
        newItem,
        additionalDataProviderType,
    );

    if (!isRequestFile(alreadyRegisteredItem) || !isRequestFile(newItem)) {
        return {
            isOutdated: isSequenceOutdated || isOutdatedDueToAdditionaData,
            details: {
                sequenceOutdated: isSequenceOutdated,
                additionalDataOutdated: isOutdatedDueToAdditionaData,
            },
        };
    }

    const areTagsOutdated = !areTagsUpToDate(alreadyRegisteredItem, newItem);

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

function isAdditionalDataUpToDate(
    alreadyRegisteredItem: CollectionItem,
    newItem: CollectionItem,
    additionalDataProviderType: AdditionalCollectionDataProviderType,
) {
    if (
        additionalDataProviderType !=
        AdditionalCollectionDataProviderType.WithAdditionalData
    ) {
        return true;
    }

    if (
        !isCollectionItemWithBruVariables(alreadyRegisteredItem) &&
        !isCollectionItemWithBruVariables(newItem)
    ) {
        return true;
    }

    return (
        isCollectionItemWithBruVariables(alreadyRegisteredItem) &&
        isCollectionItemWithBruVariables(newItem) &&
        areVariableReferencesEquivalent(
            alreadyRegisteredItem.getVariableReferences(),
            newItem.getVariableReferences(),
        )
    );
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
