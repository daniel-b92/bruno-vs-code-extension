import { dirname } from "path";
import { TypedCollection } from "../../shared";
import {
    BrunoFileType,
    CollectionItemWithSequence,
    isCollectionItemWithSequence,
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
        itemType == BrunoFileType.RequestFile,
    );

    return relevantSiblings.length == 0
        ? 1
        : Math.max(
              ...relevantSiblings
                  .map((item) => item.getSequence())
                  .filter((seq) => seq != undefined),
          ) + 1;
}

function getRelevantSiblings(
    collection: TypedCollection,
    filePath: string,
    isRequestFile: boolean,
) {
    const relevantItemType = isRequestFile
        ? BrunoFileType.RequestFile
        : NonBrunoSpecificItemType.Directory;
    const relevantReferencePath = isRequestFile ? filePath : dirname(filePath);

    return collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                dirname(item.getPath()) == dirname(relevantReferencePath) &&
                normalizePath(item.getPath()) !=
                    normalizePath(relevantReferencePath) &&
                isCollectionItemWithSequence(item) &&
                item.getItemType() == relevantItemType,
        )
        .map(({ item }) => item) as CollectionItemWithSequence[];
}
