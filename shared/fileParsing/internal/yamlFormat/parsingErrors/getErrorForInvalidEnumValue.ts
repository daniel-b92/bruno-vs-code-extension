import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { WithKeyKeyRangeAndValueRange } from "../interfaces";

export function getErrorForInvalidEnumValue(
    {
        value,
        valueRange,
    }: Pick<WithKeyKeyRangeAndValueRange<string>, "value" | "valueRange">,
    allowedValues: readonly string[],
): YamlParsingError {
    return {
        message: `Invalid value '${value}'. Allowed values are ${JSON.stringify(allowedValues, null, 2)}`,
        range: valueRange,
        code: YamlParsingErrorCode.Other,
    };
}
