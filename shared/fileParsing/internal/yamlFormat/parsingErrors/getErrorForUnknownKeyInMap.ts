import { CommonParsingArgs } from "../interfaces";
import { Range, YamlParsingError, YamlParsingErrorCode } from "../../../..";

export function getErrorForUnknownKeyInMap(
    args: CommonParsingArgs & {
        unknownKey: string;
        keyRange: Range;
        allowedKeys: string[];
    },
): YamlParsingError {
    const { unknownKey, keyRange, allowedKeys } = args;
    return {
        message: `Unknown key '${unknownKey}'. Allowed keys are ${JSON.stringify(allowedKeys, null, 2)}`,
        range: keyRange,
        code: YamlParsingErrorCode.UnknownFieldInMap,
    };
}
