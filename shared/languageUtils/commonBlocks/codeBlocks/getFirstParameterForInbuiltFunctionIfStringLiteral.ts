import {
    InbuiltFunctionIdentifier,
    InbuiltFunctionParsingParams,
    Position,
    getInbuiltFunctionAndFirstParameterIfStringLiteral,
} from "../../..";

export function getFirstParameterForInbuiltFunctionIfStringLiteral(
    params: InbuiltFunctionParsingParams,
):
    | {
          inbuiltFunction: InbuiltFunctionIdentifier;
          variable: { name: string; start: Position; end: Position };
      }
    | undefined {
    const resultData =
        getInbuiltFunctionAndFirstParameterIfStringLiteral(params);

    if (!resultData) {
        return undefined;
    }

    const {
        inbuiltFunction: { identifier: InbuiltFunctionIdentifier },
        firstParameter: {
            name: variableName,
            nodeContainsPosition,
            start,
            end,
        },
    } = resultData;

    return nodeContainsPosition
        ? {
              inbuiltFunction: InbuiltFunctionIdentifier,
              variable: { name: variableName, start, end },
          }
        : undefined;
}
