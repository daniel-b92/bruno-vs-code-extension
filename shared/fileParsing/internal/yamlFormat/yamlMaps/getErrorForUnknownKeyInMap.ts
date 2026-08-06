import { CommonParsingArgs } from "../interfaces";
import {
    Range,
    YamlParsingError,
    YamlParsingSpecialErrorCode,
} from "../../../..";

export function getErrorForUnknownKeyInMap(
    args: CommonParsingArgs & {
        unknownKey: string;
        keyRange: Range;
    },
): YamlParsingError {
    const { unknownKey, keyRange } = args;
    return {
        message: `Unknown key '${unknownKey}' defined for Yaml map.`,
        range: keyRange,
        code: YamlParsingSpecialErrorCode.UnknownFieldInMap,
    };
}
