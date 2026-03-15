import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    isBlockCodeBlock,
    VariableReferenceType,
    Position,
    CollectionItem,
    Collection,
    BrunoFileType,
    CollectionDirectory,
    isCollectionDirectory,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { TypedCollection, TypedCollectionData } from "../../../shared";

export function getDynamicVariableReferencesFromOtherFiles(
    {
        request: { filePath, token },
        file: { collection },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    functionType: VariableReferenceType,
) {
    const relevantReferenceType =
        functionType == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;

    const sourceData = collection.getStoredDataForPath(filePath);

    if (!sourceData) {
        return [];
    }

    if (functionType == VariableReferenceType.Read) {
        return getDynamicReferencesForEarlierExecutionTimesInFile(
            sourceData.item,
            collection,
            relevantReferenceType,
        );
    }

    if (token.isCancellationRequested) {
        logger?.debug("Cancellation requested for language feature.");
        return [];
    }
}

function getReferencesForEarlierExecutionTimes(
    sourceItem: CollectionItem,
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
) {
    if (isCollectionDirectory(sourceItem)) {
        return getReferencesForEarlierExecutionTimesForFolder(
            sourceItem,
            collection,
            relevantReferenceType,
        );
    }
}

function getReferencesForEarlierExecutionTimesForFolder(
    sourceItem: CollectionDirectory,
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
) {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }
}
