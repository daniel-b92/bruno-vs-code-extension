import { BrunoVariableReference, VariableReferenceType } from "@global_shared";
import { EquivalentDynamicReferencesFromOtherFiles } from "../bruFiles/shared/interfaces";

export function groupReferencesByName(
    fromSameFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
) {
    const groupedRefsFromOwnFile = groupReferencesFromSameFile(fromSameFile);

    return;
}

function groupReferencesFromSameFile(
    references: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
) {
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
                const distinctBlocks = allBlocksWithReferences.filter(
                    (block, index) =>
                        allBlocksWithReferences.indexOf(block) == index,
                );

                return {
                    blockName,
                    variableName,
                    referenceType,
                    references: {
                        hasDuplicateReferences,
                        totalNumberOfReferences: allBlocksWithReferences.length,
                        distinctBlocks,
                    },
                };
            },
        );
}

function getCombinedReferencesFromOwnFileAndOtherFiles(
    fromOwnFile: {
        variableName: string;
        referenceType: VariableReferenceType;
    }[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
): {
    variableName: string;
    referenceType: VariableReferenceType;
    hasReferenceInOwnFile: boolean;
    referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
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
                  })
                : prev.map((entry, index) =>
                      index != matchingEntryIndex
                          ? entry
                          : { ...entry, referencesFromOtherFiles: entry.referencesFromOtherFiles ? {most}:  },
                  );
        },
        fromOwnFile.map(({ variableName, referenceType }) => ({
            variableName,
            referenceType,
            hasReferenceInOwnFile: true,
            referencesFromOtherFiles: undefined,
        })) as {
            variableName: string;
            referenceType: VariableReferenceType;
            hasReferenceInOwnFile: boolean;
            referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
        }[],
    );
}
