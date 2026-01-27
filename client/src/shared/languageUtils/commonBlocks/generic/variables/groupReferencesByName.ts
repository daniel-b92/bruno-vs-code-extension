import { BrunoVariableReference } from "../../../contentInterfaces";

export function groupReferencesByName(
    variableReferences: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
) {
    const duplicateReferences: {
        variableName: string;
        blockName: string;
    }[] = [];

    return variableReferences
        .filter(({ blockName, variableReference: { variableName } }, index) => {
            const isUnique =
                variableReferences.findIndex(
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
