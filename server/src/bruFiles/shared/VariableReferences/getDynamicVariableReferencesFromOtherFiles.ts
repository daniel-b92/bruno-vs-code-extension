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
import { dirname, relative } from "path";
import {
    DynamicReferenceFromOtherFile,
    EquivalentDynamicReferencesFromOtherFiles,
} from "../interfaces";

enum SearchDirection {
    Forwards = 1,
    Backwards = 2,
}

export function getDynamicVariableReferencesFromOtherFiles(
    filePath: string,
    collection: TypedCollection,
    functionTypeInSourceFile: VariableReferenceType,
) {
    const relevantReferenceType =
        functionTypeInSourceFile == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;

    const sourceData = collection.getStoredDataForPath(filePath);

    if (!sourceData) {
        return [];
    }

    switch (functionTypeInSourceFile) {
        case VariableReferenceType.Read:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                SearchDirection.Backwards,
            );
        case VariableReferenceType.Write:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                SearchDirection.Forwards,
            );
    }
}

function getReferencesFromAncestorFoldersAndTheirDescendants(
    sourceItem: CollectionItem,
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
    searchDirection: SearchDirection,
): EquivalentDynamicReferencesFromOtherFiles[] {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }

    const referencesFromAncestors: DynamicReferenceFromOtherFile[] = [];
    const referencesFromDescendantsOfAncestors: {
        reference: DynamicReferenceFromOtherFile;
        sequence?: number;
    }[] = [];
    let currentItem: CollectionItem | undefined = undefined;
    let nextItem = sourceItem;
    let ascensionIndex = 0;

    do {
        currentItem = nextItem;
        const currentParentFolderPath = dirname(currentItem.getPath());
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

        nextItem = parentFolderData.item;

        referencesFromAncestors.push(
            ...getReferencesFromAncestorFolder(
                sourceItem.getPath(),
                parentFolderData,
                relevantReferenceType,
            ),
        );

        if (isCollectionItemWithSequence(currentItem)) {
            referencesFromDescendantsOfAncestors.push(
                ...getReferencesFromFolderDescendants(
                    {
                        parentFolder: parentFolderData.item,
                        referenceChildItem: currentItem,
                    },
                    collection,
                    sourceItem.getPath(),
                    relevantReferenceType,
                    searchDirection,
                ).map(({ reference, relativePathToSourceFile, sequence }) => ({
                    reference: {
                        reference,
                        relativePathToSourceFile,
                        indirectionLevel: ascensionIndex,
                    },
                    sequence,
                })),
            );
        }
    } while (!collection.isRootDirectory(currentItem.getPath()));

    return groupReferences(
        referencesFromAncestors,
        referencesFromDescendantsOfAncestors,
        searchDirection,
    ).map(
        ({
            mostRelevantReference: { reference: mostRelevantReference },
            otherMatchingReferences,
        }) => ({ mostRelevantReference, otherMatchingReferences }),
    );
}

function getReferencesFromAncestorFolder(
    sourceFilePath: string,
    folderData: TypedCollectionData,
    relevantReferenceType: VariableReferenceType,
): DynamicReferenceFromOtherFile[] {
    if (!folderData.additionalData) {
        return [];
    }

    return filterOutDuplicateReferences(folderData.additionalData)
        .filter(({ referenceType }) => referenceType == relevantReferenceType)
        .map((reference) => ({
            relativePathToSourceFile: relative(
                sourceFilePath,
                folderData.item.getPath(),
            ),
            // Use indirectionLevel '0' because the steps in ancestor folders are always executed directly before the steps in the given item itself.
            indirectionLevel: 0,
            reference,
        }));
}

function getReferencesFromFolderDescendants(
    ancestorLineData: {
        parentFolder: CollectionDirectory;
        referenceChildItem: CollectionItemWithSequence;
    },
    collection: TypedCollection,
    sourceFilePath: string,
    relevantReferenceType: VariableReferenceType,
    searchDirection: SearchDirection,
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

            return searchDirection == SearchDirection.Backwards
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

    return [...relevantSiblings, ...descendantsOfSiblings].reduce(
        (prev, { item, additionalData }) => {
            if (!additionalData) {
                return prev;
            }

            return prev.concat(
                filterOutDuplicateReferences(additionalData)
                    .map((reference) => ({
                        relativePathToSourceFile: relative(
                            sourceFilePath,
                            item.getPath(),
                        ),
                        reference,
                        sequence: isCollectionItemWithSequence(item)
                            ? item.getSequence()
                            : undefined,
                    }))
                    .filter(
                        ({ reference: { referenceType } }) =>
                            referenceType == relevantReferenceType,
                    ),
            );
        },
        [] as {
            relativePathToSourceFile: string;
            reference: BrunoVariableReference;
            sequence?: number;
        }[],
    );
}

function filterOutDuplicateReferences(references: BrunoVariableReference[]) {
    return references.filter(
        (data, index) =>
            references.findIndex(
                ({
                    referenceType: existingRefType,
                    variableName: existingVarName,
                }) =>
                    existingRefType == data.referenceType &&
                    existingVarName == data.variableName,
            ) == index,
    );
}

function groupReferences(
    referencesFromAncestors: DynamicReferenceFromOtherFile[],
    referencesFromDescendantsOfAncestors: {
        reference: DynamicReferenceFromOtherFile;
        sequence?: number;
    }[],
    searchDirection: SearchDirection,
) {
    return (
        referencesFromAncestors.map((reference) => ({
            reference,
            sequence: undefined,
        })) as {
            reference: DynamicReferenceFromOtherFile;
            sequence?: number;
        }[]
    )
        .concat(referencesFromDescendantsOfAncestors)
        .reduce(
            (prev, curr) => {
                const {
                    reference: { reference, indirectionLevel },
                    sequence,
                } = curr;

                const matchingReferenceIndex = prev.findIndex(
                    ({
                        mostRelevantReference: {
                            reference: { reference: registeredReference },
                        },
                    }) =>
                        reference.variableName ==
                            registeredReference.variableName &&
                        reference.referenceType ==
                            registeredReference.referenceType,
                );

                if (matchingReferenceIndex < 0) {
                    return prev.concat({
                        mostRelevantReference: curr,
                        otherMatchingReferences: [],
                    });
                }

                const {
                    reference: {
                        indirectionLevel: minimumIndirectionLevelSoFar,
                    },
                    sequence: sequenceOfMostRelevantReference,
                } = prev[matchingReferenceIndex].mostRelevantReference;

                if (
                    indirectionLevel < minimumIndirectionLevelSoFar ||
                    (indirectionLevel == minimumIndirectionLevelSoFar &&
                        sequence != undefined &&
                        sequenceOfMostRelevantReference != undefined &&
                        (searchDirection == SearchDirection.Forwards
                            ? sequence < sequenceOfMostRelevantReference
                            : sequence > sequenceOfMostRelevantReference))
                ) {
                    // The reference with the minimum indirection level is always the most relevant one.
                    // For multiple references with the same indirection level, the one with the sequence closest to the source item is most relevant.
                    return prev.map((entry, index) =>
                        index != matchingReferenceIndex
                            ? entry
                            : {
                                  mostRelevantReference: curr,
                                  otherMatchingReferences:
                                      entry.otherMatchingReferences.concat(
                                          entry.mostRelevantReference.reference,
                                      ),
                              },
                    );
                }

                return prev.map((entry, index) =>
                    index != matchingReferenceIndex
                        ? entry
                        : {
                              mostRelevantReference:
                                  entry.mostRelevantReference,
                              otherMatchingReferences:
                                  entry.otherMatchingReferences.concat(
                                      curr.reference,
                                  ),
                          },
                );
            },
            [] as {
                mostRelevantReference: {
                    reference: DynamicReferenceFromOtherFile;
                    sequence?: number;
                };
                otherMatchingReferences: DynamicReferenceFromOtherFile[];
            }[],
        );
}
