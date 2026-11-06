import {
    BrunoVariableType,
    VariableReferenceType,
    getInbuiltFunctions,
    InbuiltFunctionName,
} from "../../../../..";

export function getInbuiltFunctionIdentifiers(filter?: {
    referenceType?: VariableReferenceType;
    variableType?: BrunoVariableType;
}) {
    const allFunctions = Object.values(InbuiltFunctionName).map(
        (functionName) => getInbuiltFunctions()[functionName],
    );

    return allFunctions
        .filter(
            ({ referenceType, variableType }) =>
                (filter?.referenceType == undefined ||
                    referenceType == filter.referenceType) &&
                (filter?.variableType == undefined ||
                    variableType == filter.variableType),
        )
        .map(({ identifier }) => identifier);
}
