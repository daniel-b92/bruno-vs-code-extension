import {
    VariableReferenceType,
    CollectionItem,
    CollectionDirectory,
    isCollectionDirectory,
    BrunoVariableReference,
    CollectionItemWithSequence,
    normalizePath,
    isCollectionItemWithSequence,
    BrunoVariableType,
} from "@global_shared";
import { TypedCollection, TypedCollectionData } from "../../../shared";
import { dirname, relative } from "path";
import {
    DynamicReferenceFromOtherFile,
    EquivalentDynamicReferencesFromOtherFiles,
} from "../interfaces";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";

enum SearchDirection {
    Forwards = 1,
    Backwards = 2,
}

export function getDynamicVariableReferencesFromOtherFiles(
    filePath: string,
    collection: TypedCollection,
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    const relevantReferenceType =
        referenceTypeInSourceFile == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;
    const relevantVariableTypes =
        variableTypeInSourceFile == BrunoVariableType.Unknown
            ? Object.values(BrunoVariableType)
            : [variableTypeInSourceFile];

    const sourceData = collection.getStoredDataForPath(filePath);

    if (!sourceData) {
        return [];
    }

    switch (referenceTypeInSourceFile) {
        case VariableReferenceType.Read:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                relevantVariableTypes,
                SearchDirection.Backwards,
            );
        case VariableReferenceType.Write:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                relevantReferenceType,
                relevantVariableTypes,
                SearchDirection.Forwards,
            );
    }
}

function getReferencesFromAncestorFoldersAndTheirDescendants(
    sourceItem: CollectionItem,
    collection: TypedCollection,
    relevantReferenceType: VariableReferenceType,
    relevantVariableTypes: BrunoVariableType[],
    searchDirection: SearchDirection,
): EquivalentDynamicReferencesFromOtherFiles[] {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }

    const referencesFromAncestors: DynamicReferenceFromOtherFile[] = [];
    const referencesFromDescendantsOfAncestors: DynamicReferenceFromOtherFile[] =
        [];
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
                relevantVariableTypes,
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
                    ascensionIndex,
                    {
                        relevantReferenceType,
                        relevantVariableTypes,
                        searchDirection,
                    },
                ),
            );
        }
    } while (!collection.isRootDirectory(currentItem.getPath()));

    return groupReferences(
        referencesFromAncestors,
        referencesFromDescendantsOfAncestors,
        collection,
        searchDirection,
    );
}

function getReferencesFromAncestorFolder(
    sourceFilePath: string,
    folderData: TypedCollectionData,
    relevantReferenceType: VariableReferenceType,
    relevantVariableTypes: BrunoVariableType[],
): DynamicReferenceFromOtherFile[] {
    if (!folderData.additionalData) {
        return [];
    }

    return filterOutDuplicateReferences(folderData.additionalData)
        .filter(
            ({ referenceType, variableType }) =>
                referenceType == relevantReferenceType &&
                relevantVariableTypes.includes(variableType),
        )
        .map((reference) => ({
            path: {
                absolute: folderData.item.getPath(),
                relativeToSourceFile: relative(
                    sourceFilePath,
                    folderData.item.getPath(),
                ),
            },
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
    indirectionLevelForResponse: number,
    filters: {
        relevantReferenceType: VariableReferenceType;
        searchDirection: SearchDirection;
        relevantVariableTypes: BrunoVariableType[];
    },
): DynamicReferenceFromOtherFile[] {
    const { parentFolder, referenceChildItem } = ancestorLineData;
    const { relevantReferenceType, relevantVariableTypes, searchDirection } =
        filters;

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
                        path: {
                            absolute: item.getPath(),
                            relativeToSourceFile: relative(
                                sourceFilePath,
                                item.getPath(),
                            ),
                        },
                        indirectionLevel: indirectionLevelForResponse,
                        reference,
                    }))
                    .filter(
                        ({ reference: { referenceType, variableType } }) =>
                            referenceType == relevantReferenceType &&
                            relevantVariableTypes.includes(variableType),
                    ),
            );
        },
        [] as DynamicReferenceFromOtherFile[],
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
    referencesFromDescendantsOfAncestors: DynamicReferenceFromOtherFile[],
    collection: TypedCollection,
    searchDirection: SearchDirection,
) {
    return referencesFromAncestors
        .concat(referencesFromDescendantsOfAncestors)
        .reduce(
            (prev, curr) => {
                const { reference } = curr;

                const matchingReferenceIndex = prev.findIndex(
                    ({ mostRelevantReference: { reference: registered } }) =>
                        areReferencesEquivalentForLanguageFeatures(
                            reference,
                            registered,
                        ),
                );

                if (matchingReferenceIndex < 0) {
                    return prev.concat({
                        mostRelevantReference: curr,
                        otherMatchingReferences: [],
                    });
                }

                const mostRelevantReferenceSoFar =
                    prev[matchingReferenceIndex].mostRelevantReference;

                if (
                    isFirstReferenceMoreRelevant(
                        curr,
                        mostRelevantReferenceSoFar,
                        collection,
                        searchDirection,
                    ) === true
                ) {
                    return prev.map((entry, index) =>
                        index != matchingReferenceIndex
                            ? entry
                            : {
                                  mostRelevantReference: curr,
                                  otherMatchingReferences:
                                      entry.otherMatchingReferences.concat(
                                          mostRelevantReferenceSoFar,
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
                                  entry.otherMatchingReferences.concat(curr),
                          },
                );
            },
            [] as {
                mostRelevantReference: DynamicReferenceFromOtherFile;
                otherMatchingReferences: DynamicReferenceFromOtherFile[];
            }[],
        );
}

// The reference with the minimum indirection level is always the most relevant one.
// For multiple references with the same indirection level, the one with the sequence closest to the source item is most relevant.
function isFirstReferenceMoreRelevant(
    ref1: DynamicReferenceFromOtherFile,
    ref2: DynamicReferenceFromOtherFile,
    collection: TypedCollection,
    searchDirection: SearchDirection,
) {
    const {
        indirectionLevel: indirectionLevel1,
        path: { absolute: path1 },
    } = ref1;
    const {
        indirectionLevel: indirectionLevel2,
        path: { absolute: path2 },
    } = ref2;

    if (indirectionLevel1 != indirectionLevel2) {
        return indirectionLevel1 < indirectionLevel2;
    }

    const commonAncestors = collection.getCommonAncestorData(path1, path2);

    const lastCommonAncestorFolder =
        commonAncestors.length == 0
            ? undefined
            : commonAncestors.sort(
                  ({ item: item1 }, { item: item2 }) =>
                      normalizePath(item1.getPath()).length -
                      normalizePath(item2.getPath()).length,
              )[0];

    if (!lastCommonAncestorFolder) {
        return undefined;
    }

    const relevantAncestorDataForRef1 = collection
        .getCommonAncestorData(path1)
        .find(
            ({ item }) =>
                normalizePath(dirname(item.getPath())) ==
                normalizePath(lastCommonAncestorFolder.item.getPath()),
        );
    const relevantAncestorDataForRef2 = collection
        .getCommonAncestorData(path2)
        .find(
            ({ item }) =>
                normalizePath(dirname(item.getPath())) ==
                normalizePath(lastCommonAncestorFolder.item.getPath()),
        );

    if (
        relevantAncestorDataForRef1 == undefined ||
        relevantAncestorDataForRef2 == undefined ||
        !isCollectionItemWithSequence(relevantAncestorDataForRef1.item) ||
        !isCollectionItemWithSequence(relevantAncestorDataForRef2.item)
    ) {
        return undefined;
    }

    const sequenceForRef1 =
        relevantAncestorDataForRef1.item.getSequence() == undefined;
    const sequenceForRef2 =
        relevantAncestorDataForRef2.item.getSequence() == undefined;

    return sequenceForRef1 == undefined || sequenceForRef2 == undefined
        ? undefined
        : searchDirection == SearchDirection.Forwards
          ? sequenceForRef1 < sequenceForRef2
          : sequenceForRef1 > sequenceForRef2;
}
