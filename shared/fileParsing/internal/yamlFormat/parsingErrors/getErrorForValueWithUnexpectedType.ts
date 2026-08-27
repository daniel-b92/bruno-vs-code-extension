import { CommonParsingArgs } from "../interfaces";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";

export function getErrorForValueWithUnexpectedType(
    args: CommonParsingArgs & {
        key: string;
        valueRange: Range;
        expectedType:
            "boolean" | "number" | "string" | "Map" | "Sequence" | "Scalar";
    },
): YamlParsingError {
    const { valueRange, expectedType } = args;
    return {
        message: `Expected value to be of type '${expectedType}'.`,
        range: valueRange,
        code: YamlParsingErrorCode.Other,
    };
}
