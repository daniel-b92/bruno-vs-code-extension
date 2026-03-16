import {
    VariableReferenceType,
    CollectionItem,
    CollectionDirectory,
    isCollectionDirectory,
    BrunoVariableReference,
    CollectionItemWithSequence,
    normalizePath,
    isCollectionItemWithSequence,
} from "@global_shared";
import { TypedCollection, TypedCollectionData } from "../../../shared";
import { dirname } from "path";

export function getDynamicVariableReferencesFromOtherFiles(
    filePath: string,
    collection: TypedCollection,
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

    switch (functionType) {
        case VariableReferenceType.Read:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                true,
            );
        case VariableReferenceType.Write:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                false,
            );
    }
}

function getReferencesFromAncestorFoldersAndTheirDescendants(
    sourceItem: CollectionItem,
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
    forEarlierExecutionTimes: boolean,
) {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }

    const result: {
        indirectionLevel: number;
        reference: BrunoVariableReference;
    }[] = [];
    let currentChildItem = sourceItem;
    let currentParentFolderPath: string | undefined = undefined;
    let ascensionIndex = 0;

    do {
        currentParentFolderPath = dirname(currentChildItem.getPath());
        ascensionIndex++;
        const parentFolderData = collection.getStoredDataForPath(
            currentParentFolderPath,
        );

        if (
            !parentFolderData ||
            !isCollectionDirectory(parentFolderData.item)
        ) {
            break;
        }

        result.push(
            // Use indirectionLevel '0' because the steps in ancestor folders are always executed directly before the steps in the given item itself.
            ...getReferencesFromAncestorFolder(
                parentFolderData,
                relevantReferenceType,
            ).map((reference) => ({ indirectionLevel: 0, reference })),
        );

        if (isCollectionItemWithSequence(currentChildItem)) {
            result.push(
                ...getReferencesFromFolderDescendants(
                    {
                        parentFolder: parentFolderData.item,
                        referenceChildItem: currentChildItem,
                    },
                    collection,
                    relevantReferenceType,
                    forEarlierExecutionTimes,
                ).map((reference) => ({
                    indirectionLevel: ascensionIndex,
                    reference,
                })),
            );
        }
    } while (!collection.isRootDirectory(currentParentFolderPath));

    return result;
}

function getReferencesFromAncestorFolder(
    folderData: TypedCollectionData,
    relevantReferenceType: VariableReferenceType,
) {
    return folderData.additionalData
        ? folderData.additionalData.filter(
              ({ referenceType }) => referenceType == relevantReferenceType,
          )
        : [];
}

function getReferencesFromFolderDescendants(
    ancestorLineData: {
        parentFolder: CollectionDirectory;
        referenceChildItem: CollectionItemWithSequence;
    },
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
    forEarlierExecutionTimes: boolean,
) {
    const { parentFolder, referenceChildItem } = ancestorLineData;

    const childItemSequence = referenceChildItem.getSequence();
    if (childItemSequence === undefined) {
        return [];
    }

    const relevantSiblings = collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const isSibling =
                normalizePath(dirname(item.getPath())) ==
                normalizePath(parentFolder.getPath());

            if (!isSibling || !isCollectionItemWithSequence(item)) {
                return false;
            }

            const itemSequence = item.getSequence();

            if (itemSequence == undefined) {
                return false;
            }

            forEarlierExecutionTimes
                ? itemSequence < childItemSequence
                : itemSequence > childItemSequence;
        });

    const descendantsOfSiblings = collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const descendantPath = normalizePath(item.getPath());

            return relevantSiblings.some(({ item: siblingItem }) => {
                const siblingItemPath = normalizePath(siblingItem.getPath());
                return (
                    descendantPath.startsWith(siblingItemPath) &&
                    descendantPath.length > siblingItemPath.length
                );
            });
        });

    return [...relevantSiblings, ...descendantsOfSiblings].flatMap(
        ({ additionalData }) =>
            additionalData
                ? additionalData.filter(
                      ({ referenceType }) =>
                          referenceType == relevantReferenceType,
                  )
                : [],
    );
}
