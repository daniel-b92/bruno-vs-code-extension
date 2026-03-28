import { MatchingDynamicVariables } from "../interfaces";

export function includesMultipleDistinctVariableTypes({
    fromSameFile,
    fromOtherFiles,
}: MatchingDynamicVariables) {
    const allVariableTypes = fromSameFile
        .map(({ variableReference: { variableType } }) => variableType)
        .concat(
            fromOtherFiles.map(
                ({
                    mostRelevantReference: {
                        reference: { variableType },
                    },
                }) => variableType,
            ),
        );

    return allVariableTypes.some((val) => allVariableTypes.indexOf(val) != 0);
}
