import { InbuiltFunctionIdentifier, getInbuiltFunctions } from "../../../..";

export function getInbuiltFunctionAvailabilityScope({
    functionName,
}: InbuiltFunctionIdentifier) {
    return getInbuiltFunctions()[functionName].scope;
}
