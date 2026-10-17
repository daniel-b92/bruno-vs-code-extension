import { dirname } from "path";
import { TypedCollection } from "../../shared";
import {
    BrunoFileType,
    CollectionItemWithSequence,
    isCollectionItemWithSequence,
    ItemType,
    NonBrunoSpecificItemType,
    normalizePath,
} from "@global_shared";

export function getSequenceValueCompletion(
    collection: TypedCollection,
    filePath: string,
    itemType: BrunoFileType,
) {
    if (
        itemType == BrunoFileType.EnvironmentFile ||
        itemType == BrunoFileType.CollectionSettingsFile
    ) {
        return undefined;
    }

    const relevantSiblings = getRelevantSiblings(
        collection,
        filePath,
        itemType == BrunoFileType.RequestFile ||
            itemType == BrunoFileType.AppFile,
    );

    const relevantSiblingSequences = relevantSiblings
        .map((item) => item.getSequence())
        .filter((seq) => seq != undefined);

    return relevantSiblingSequences.length == 0
        ? 1
        : Math.max(...relevantSiblingSequences) + 1;
}

function getRelevantSiblings(
    collection: TypedCollection,
    filePath: string,
    isRequestFile: boolean,
) {
    // App files and request files share the same sequence range within a folder.
    const relevantItemTypes: ItemType[] = isRequestFile
        ? [BrunoFileType.RequestFile, BrunoFileType.AppFile]
        : [NonBrunoSpecificItemType.Directory];
    const relevantReferencePath = isRequestFile ? filePath : dirname(filePath);

    return collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                normalizePath(dirname(item.getPath())) ==
                    normalizePath(dirname(relevantReferencePath)) &&
                normalizePath(item.getPath()) !=
                    normalizePath(relevantReferencePath) &&
                isCollectionItemWithSequence(item) &&
                relevantItemTypes.includes(item.getItemType()),
        )
        .map(({ item }) => item) as CollectionItemWithSequence[];
}
