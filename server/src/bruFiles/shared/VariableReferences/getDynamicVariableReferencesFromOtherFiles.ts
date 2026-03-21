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
): EquivalentDynamicReferencesFromOtherFiles[] {
    if (collection.isRootDirectory(sourceItem.getPath())) {
        // There are not other files within a collection that will be executed before the collection root folder script.
        return [];
    }

    const allReferences: DynamicReferenceFromOtherFile[] = [];
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

        allReferences.push(
            ...getReferencesFromAncestorFolder(
                sourceItem.getPath(),
                parentFolderData,
                relevantReferenceType,
            ),
        );

        if (isCollectionItemWithSequence(currentItem)) {
            allReferences.push(
                ...getReferencesFromFolderDescendants(
                    {
                        parentFolder: parentFolderData.item,
                        referenceChildItem: currentItem,
                    },
                    collection,
                    sourceItem.getPath(),
                    relevantReferenceType,
                    forEarlierExecutionTimes,
                ).map((data) => ({
                    ...data,
                    indirectionLevel: ascensionIndex,
                })),
            );
        }
    } while (!collection.isRootDirectory(currentItem.getPath()));

    return groupReferences(allReferences);
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

            return forEarlierExecutionTimes
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

            const currentRelativePath = relative(
                sourceFilePath,
                item.getPath(),
            );

            return prev.concat(
                filterOutDuplicateReferences(additionalData)
                    .map((reference) => ({
                        relativePathToSourceFile: currentRelativePath,
                        reference,
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

function groupReferences(references: DynamicReferenceFromOtherFile[]) {
    return references.reduce((prev, curr) => {
        const { reference, indirectionLevel } = curr;

        const matchingEntryIndex = prev.findIndex(
            ({
                mostRelevantReference: {
                    reference: registeredReference,
                    indirectionLevel: registeredIndirectionLevel,
                },
            }) =>
                reference.variableName == registeredReference.variableName &&
                reference.referenceType == registeredReference.referenceType &&
                indirectionLevel >= registeredIndirectionLevel,
        );

        return matchingEntryIndex < 0
            ? prev.concat({
                  mostRelevantReference: curr,
                  otherMatchingReferences: [],
              })
            : prev.map((entry, index) =>
                  index == matchingEntryIndex
                      ? {
                            mostRelevantReference: entry.mostRelevantReference,
                            otherMatchingReferences:
                                entry.otherMatchingReferences.concat(curr),
                        }
                      : entry,
              );
    }, [] as EquivalentDynamicReferencesFromOtherFiles[]);
}
