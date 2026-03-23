import { InbuiltFunctionIdentifier, getInbuiltFunctions } from "../../../..";

export function getInbuiltFunctionVariableType({
    functionName,
}: InbuiltFunctionIdentifier) {
    return getInbuiltFunctions()[functionName].variableType;
}
