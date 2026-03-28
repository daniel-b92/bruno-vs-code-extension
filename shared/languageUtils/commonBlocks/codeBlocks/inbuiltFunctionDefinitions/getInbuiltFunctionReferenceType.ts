import { InbuiltFunctionIdentifier, getInbuiltFunctions } from "../../../..";

export function getInbuiltFunctionReferenceType({
    functionName,
}: InbuiltFunctionIdentifier) {
    return getInbuiltFunctions()[functionName].referenceType;
}
