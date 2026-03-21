import { BrunoVariableReference, VariableReferenceType } from "@global_shared";
import { EquivalentDynamicReferencesFromOtherFiles } from "../bruFiles/shared/interfaces";

export interface ReferenceFromOwnFileDetails {
    blockName: string;
    hasDuplicateReferences: boolean;
    totalNumberOfReferences: number;
    allDistinctBlocks: string[];
}

interface GroupedReferenceFromOwnFile {
    variableName: string;
    referenceType: VariableReferenceType;
    details: ReferenceFromOwnFileDetails;
}

export function groupReferencesByName(
    fromSameFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
) {
    const groupedRefsFromOwnFile = groupReferencesFromSameFile(fromSameFile);

    return getCombinedReferencesFromOwnFileAndOtherFiles(
        groupedRefsFromOwnFile,
        fromOtherFiles,
    );
}

function groupReferencesFromSameFile(
    references: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
): GroupedReferenceFromOwnFile[] {
    const duplicateReferences: {
        variableName: string;
        blockName: string;
    }[] = [];

    return references
        .filter(({ blockName, variableReference: { variableName } }, index) => {
            const isUnique =
                references.findIndex(
                    ({ variableReference: { variableName: n } }) =>
                        n == variableName,
                ) == index;

            if (!isUnique) {
                duplicateReferences.push({ blockName, variableName });
            }

            return isUnique;
        })
        .map(
            ({
                blockName,
                variableReference: { variableName, referenceType },
            }) => {
                const blocksWithDuplicateReferences = duplicateReferences
                    .filter(({ variableName: name }) => name == variableName)
                    .map(({ blockName }) => blockName);

                const hasDuplicateReferences =
                    blocksWithDuplicateReferences.length > 0;
                const allBlocksWithReferences =
                    blocksWithDuplicateReferences.concat(blockName);
                const allDistinctBlocks = allBlocksWithReferences.filter(
                    (block, index) =>
                        allBlocksWithReferences.indexOf(block) == index,
                );

                return {
                    variableName,
                    referenceType,
                    details: {
                        blockName,
                        hasDuplicateReferences,
                        totalNumberOfReferences: allBlocksWithReferences.length,
                        allDistinctBlocks,
                    },
                };
            },
        );
}

function getCombinedReferencesFromOwnFileAndOtherFiles(
    fromOwnFile: GroupedReferenceFromOwnFile[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
): {
    variableName: string;
    referenceType: VariableReferenceType;
    hasReferenceInOwnFile: boolean;
    referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
    detailsForOwnFileRefs?: ReferenceFromOwnFileDetails;
}[] {
    return fromOtherFiles.reduce(
        (prev, curr) => {
            const {
                mostRelevantReference: {
                    reference: { variableName, referenceType },
                },
            } = curr;

            const matchingEntryIndex = prev.findIndex(
                ({ variableName: v, referenceType: r }) =>
                    v == variableName && r == referenceType,
            );

            return matchingEntryIndex < 0
                ? prev.concat({
                      variableName,
                      referenceType,
                      hasReferenceInOwnFile: false,
                      referencesFromOtherFiles: curr,
                      detailsForOwnFileRefs: undefined,
                  })
                : prev.map((entry, index) =>
                      index != matchingEntryIndex ||
                      entry.referencesFromOtherFiles != undefined
                          ? entry
                          : { ...entry, referencesFromOtherFiles: curr },
                  );
        },
        fromOwnFile.map(({ variableName, referenceType, details }) => ({
            variableName,
            referenceType,
            hasReferenceInOwnFile: true,
            referencesFromOtherFiles: undefined,
            detailsForOwnFileRefs: details,
        })) as {
            variableName: string;
            referenceType: VariableReferenceType;
            hasReferenceInOwnFile: boolean;
            referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
            detailsForOwnFileRefs?: ReferenceFromOwnFileDetails;
        }[],
    );
}
