import { CommonParsingArgs } from "../interfaces";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";

export function getErrorForValueWithUnexpectedType(
    args: CommonParsingArgs & {
        key: string;
        valueRange: Range;
        expectedType: "Scalar" | "Sequence" | "Map";
    },
): YamlParsingError {
    const { key, valueRange, expectedType } = args;
    return {
        message: `Expected item for key '${key}' to be of type '${expectedType}'.`,
        range: valueRange,
        code: YamlParsingErrorCode.Other,
    };
}
