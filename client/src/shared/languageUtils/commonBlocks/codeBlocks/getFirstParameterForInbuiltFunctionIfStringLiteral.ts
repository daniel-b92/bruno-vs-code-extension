import {
    InbuiltFunctionIdentifier,
    InbuiltFunctionParsingParams,
    getInbuiltFunctionAndFirstParameterIfStringLiteral,
} from "../../..";

export function getFirstParameterForInbuiltFunctionIfStringLiteral(
    params: InbuiltFunctionParsingParams,
):
    | { inbuiltFunction: InbuiltFunctionIdentifier; variableName: string }
    | undefined {
    const resultData =
        getInbuiltFunctionAndFirstParameterIfStringLiteral(params);

    if (!resultData) {
        return undefined;
    }

    const {
        inbuiltFunction: { identifier: InbuiltFunctionIdentifier },
        firstParameter: { name: variableName, nodeContainsPosition },
    } = resultData;

    return nodeContainsPosition
        ? { inbuiltFunction: InbuiltFunctionIdentifier, variableName }
        : undefined;
}
