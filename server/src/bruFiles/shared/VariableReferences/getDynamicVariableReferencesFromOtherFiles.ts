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
    VariableReferenceFromOtherFile,
    EquivalentVariableReferencesFromOtherFiles,
} from "../interfaces";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";
import { filterDynamicReferences } from "./filterDynamicReferences";

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
    const sourceData = collection.getStoredDataForPath(filePath);

    if (!sourceData) {
        return [];
    }

    switch (referenceTypeInSourceFile) {
        case VariableReferenceType.Read:
        case VariableReferenceType.Delete:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                referenceTypeInSourceFile,
                variableTypeInSourceFile,
                SearchDirection.Backwards,
            );
        case VariableReferenceType.Write:
            return getReferencesFromAncestorFoldersAndTheirDescendants(
                sourceData.item,
                collection,
                referenceTypeInSourceFile,
                variableTypeInSourceFile,
                SearchDirection.Forwards,
            );
    }
}

function getReferencesFromAncestorFoldersAndTheirDescendants(
    sourceItem: CollectionItem,
    collection: TypedCollection,
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
    searchDirection: SearchDirection,
): EquivalentVariableReferencesFromOtherFiles[] {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }

    const referencesFromAncestors: VariableReferenceFromOtherFile[] = [];
    const referencesFromDescendantsOfAncestors: VariableReferenceFromOtherFile[] =
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
                referenceTypeInSourceFile,
                variableTypeInSourceFile,
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
                    {
                        path: sourceItem.getPath(),
                        referenceType: referenceTypeInSourceFile,
                        variableType: variableTypeInSourceFile,
                    },

                    ascensionIndex,
                    searchDirection,
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
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
): VariableReferenceFromOtherFile[] {
    if (!folderData.additionalData) {
        return [];
    }

    return filterDynamicReferences(
        filterOutDuplicateReferences(folderData.additionalData),
        referenceTypeInSourceFile,
        variableTypeInSourceFile,
    ).map((reference) => ({
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
    sourceFile: {
        path: string;
        referenceType: VariableReferenceType;
        variableType: BrunoVariableType;
    },
    indirectionLevelForResponse: number,
    searchDirection: SearchDirection,
): VariableReferenceFromOtherFile[] {
    const { parentFolder, referenceChildItem } = ancestorLineData;
    const {
        path,
        referenceType: referenceTypeInSourceFile,
        variableType: variableTypeInSourceFile,
    } = sourceFile;

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
                filterDynamicReferences(
                    filterOutDuplicateReferences(additionalData),
                    referenceTypeInSourceFile,
                    variableTypeInSourceFile,
                ).map((reference) => ({
                    path: {
                        absolute: item.getPath(),
                        relativeToSourceFile: relative(path, item.getPath()),
                    },
                    indirectionLevel: indirectionLevelForResponse,
                    reference,
                })),
            );
        },
        [] as VariableReferenceFromOtherFile[],
    );
}

function filterOutDuplicateReferences(references: BrunoVariableReference[]) {
    return references.filter(
        (data, index) =>
            references.findIndex((existing) =>
                areReferencesEquivalentForLanguageFeatures(data, existing),
            ) == index,
    );
}

function groupReferences(
    referencesFromAncestors: VariableReferenceFromOtherFile[],
    referencesFromDescendantsOfAncestors: VariableReferenceFromOtherFile[],
    collection: TypedCollection,
    searchDirection: SearchDirection,
) {
    return referencesFromAncestors
        .concat(referencesFromDescendantsOfAncestors)
        .reduce(
            (prev, curr) => {
                const matchingReferenceIndex = prev.findIndex(
                    ({ mostRelevantReference: { reference: registered } }) =>
                        areReferencesEquivalentForLanguageFeatures(
                            curr.reference,
                            registered,
                        ),
                );

                if (matchingReferenceIndex < 0) {
                    return prev.concat({
                        mostRelevantReference: curr,
                        otherMatchingReferences: [],
                    });
                }

                const mostRelevantSoFar =
                    prev[matchingReferenceIndex].mostRelevantReference;

                if (
                    isFirstReferenceMoreRelevant(
                        curr,
                        mostRelevantSoFar,
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
                                          mostRelevantSoFar,
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
                mostRelevantReference: VariableReferenceFromOtherFile;
                otherMatchingReferences: VariableReferenceFromOtherFile[];
            }[],
        );
}

// The reference with the minimum indirection level is always the most relevant one.
// For multiple references with the same indirection level, the one with the sequence closest to the source item is most relevant.
function isFirstReferenceMoreRelevant(
    ref1: VariableReferenceFromOtherFile,
    ref2: VariableReferenceFromOtherFile,
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

    const sequenceForRef1 = relevantAncestorDataForRef1.item.getSequence();
    const sequenceForRef2 = relevantAncestorDataForRef2.item.getSequence();

    return sequenceForRef1 == undefined || sequenceForRef2 == undefined
        ? undefined
        : searchDirection == SearchDirection.Forwards
          ? sequenceForRef1 < sequenceForRef2
          : sequenceForRef1 > sequenceForRef2;
}
