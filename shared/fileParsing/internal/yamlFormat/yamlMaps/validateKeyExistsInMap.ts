import { YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { fromYamlRange } from "../util/fromYamlRange";

export function validateKeyExistsInMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): YamlParsingError | undefined {
    const { map, key, isTopLevelMap, fullDocumentRange, docHelper } = args;
    return map.has(key)
        ? undefined
        : {
              message: `Mandatory key '${key}' is missing in Yaml map.`,
              range: isTopLevelMap
                  ? fullDocumentRange
                  : ((map.range
                        ? fromYamlRange(map.range, docHelper)
                        : fullDocumentRange) ?? fullDocumentRange),
          };
}
