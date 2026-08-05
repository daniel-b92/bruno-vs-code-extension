import { isMap, YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { getRangeForError } from "../util/getRangeForError";

export function getYamlMapByKeyFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { map: YAMLMap<unknown, unknown> } | { error: YamlParsingError } {
    const { map: parentMap, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    const field = parentMap.get(key);
    return isMap(field)
        ? { map: field }
        : {
              error: {
                  message: `Field '${key}' should be a Yaml map. Got ${JSON.stringify(field)}`,
                  range: getRangeForError(parentMap, args),
              },
          };
}
