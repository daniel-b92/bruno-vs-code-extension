import {
    BrunoVariableReference,
    BrunoVariableType,
    VariableReferenceType,
} from "@global_shared";
import {
    EquivalentDynamicReferencesFromOtherFiles,
    MatchingDynamicVariables,
} from "../bruFiles/shared/interfaces";
import { areReferencesEquivalentForLanguageFeatures } from "../bruFiles/shared/VariableReferences/areReferencesEquivalentForLanguageFeatures";

export interface ReferenceFromOwnFileDetails {
    blockName: string;
    hasDuplicateReferences: boolean;
    totalNumberOfReferences: number;
    allDistinctBlocks: string[];
}

interface GroupedReferenceFromOwnFile {
    variableName: string;
    referenceType: VariableReferenceType;
    variableType: BrunoVariableType;
    details: ReferenceFromOwnFileDetails;
}

export function groupReferencesByName({
    fromSameFile,
    fromOtherFiles,
}: MatchingDynamicVariables) {
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
                variableReference: {
                    variableName,
                    referenceType,
                    variableType,
                },
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
                    variableType,
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
    variableType: BrunoVariableType;
    hasReferenceInOwnFile: boolean;
    referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
    detailsForOwnFileRefs?: ReferenceFromOwnFileDetails;
}[] {
    const initialArray = fromOwnFile.map(
        ({ variableName, referenceType, variableType, details }) => ({
            variableName,
            referenceType,
            variableType,
            hasReferenceInOwnFile: true,
            referencesFromOtherFiles: undefined,
            detailsForOwnFileRefs: details,
        }),
    ) as {
        variableName: string;
        referenceType: VariableReferenceType;
        variableType: BrunoVariableType;
        hasReferenceInOwnFile: boolean;
        referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
        detailsForOwnFileRefs?: ReferenceFromOwnFileDetails;
    }[];

    return fromOtherFiles.reduce((prev, curr) => {
        const {
            mostRelevantReference: { reference: mostRelevantReferenceSoFar },
        } = curr;

        const matchingEntryIndex = prev.findIndex((existingEntry) =>
            areReferencesEquivalentForLanguageFeatures(
                mostRelevantReferenceSoFar,
                existingEntry,
            ),
        );

        return matchingEntryIndex < 0
            ? prev.concat({
                  ...mostRelevantReferenceSoFar,
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
    }, initialArray);
}
