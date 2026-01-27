import {
    VariableReferenceType,
    InbuiltEnvVariableFunctionName,
    getInbuiltFunctions,
} from "../../../..";

export function getInbuiltFunctionIdentifiers(type?: VariableReferenceType) {
    const allFunctions = Object.values(InbuiltEnvVariableFunctionName).map(
        (functionName) => getInbuiltFunctions()[functionName],
    );

    return allFunctions
        .filter(({ type: t }) => (type != undefined ? t == type : true))
        .map(({ identifier }) => identifier);
}
