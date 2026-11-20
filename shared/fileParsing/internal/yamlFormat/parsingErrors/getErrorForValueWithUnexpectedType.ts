import { CommonParsingArgs } from "../interfaces";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";

type ExpectedType =
    "boolean" | "number" | "string" | "Map" | "Sequence" | "Scalar";

export function getErrorForValueWithUnexpectedType(
    args: CommonParsingArgs & {
        key: string;
        valueRange: Range;
        /** If multiple types are valid for the key, all of them should be passed. */
        expectedTypes: ExpectedType[];
    },
): YamlParsingError {
    const { valueRange, expectedTypes } = args;
    return {
        message: `Expected value to be of type ${expectedTypes
            .map((type) => `'${type}'`)
            .join(" or ")}.`,
        range: valueRange,
        code: YamlParsingErrorCode.Other,
    };
}
