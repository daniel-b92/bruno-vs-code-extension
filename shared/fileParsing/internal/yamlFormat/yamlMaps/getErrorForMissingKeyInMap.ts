import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { YAMLMap } from "yaml";
import { getRangeForItem } from "../util/getRangeForItem";

export function getErrorForMissingKeyInMap(
    args: CommonParsingArgs & {
        missingKey: string;
        map: YAMLMap<unknown, unknown>;
    },
): YamlParsingError {
    const { missingKey, map } = args;
    return {
        message: `Mandatory key '${missingKey}' missing in Yaml map.`,
        range: getRangeForItem(map, args),
        code: YamlParsingErrorCode.ItemDoesNotExist,
    };
}
