import {
    VariableReferenceType,
    getInbuiltFunctions,
    InbuiltFunctionName,
} from "../../../..";

export function getInbuiltFunctionIdentifiers(type?: VariableReferenceType) {
    const allFunctions = Object.values(InbuiltFunctionName).map(
        (functionName) => getInbuiltFunctions()[functionName],
    );

    return allFunctions
        .filter(({ referenceType: t }) =>
            type != undefined ? t == type : true,
        )
        .map(({ identifier }) => identifier);
}
