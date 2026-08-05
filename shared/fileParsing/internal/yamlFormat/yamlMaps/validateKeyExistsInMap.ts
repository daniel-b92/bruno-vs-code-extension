import { YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError, YamlParsingSpecialErrorCode } from "../../../..";
import { getRangeForError } from "../util/getRangeForError";

export function validateKeyExistsInMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): YamlParsingError | undefined {
    const { map, key, isTopLevelMap, fullDocumentRange } = args;
    return map.has(key)
        ? undefined
        : {
              message: `Mandatory key '${key}' is missing in Yaml map.`,
              range: isTopLevelMap
                  ? fullDocumentRange
                  : getRangeForError(map, args),
              code: YamlParsingSpecialErrorCode.FieldDoesNotExist,
          };
}
