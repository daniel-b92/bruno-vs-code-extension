import { InbuiltFunctionIdentifier, getInbuiltFunctions } from "../../../..";

export function getInbuiltFunctionType({
    functionName,
}: InbuiltFunctionIdentifier) {
    return getInbuiltFunctions()[functionName].type;
}
