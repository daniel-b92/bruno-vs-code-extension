import { isSeq, YAMLMap, YAMLSeq } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { getRangeForError } from "../util/getRangeForError";

export function getYamlSequenceByKeyFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { value: YAMLSeq<unknown> } | { error: YamlParsingError } {
    const { map: parentMap, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    const field = parentMap.get(key);
    return isSeq(field)
        ? { value: field }
        : {
              error: {
                  message: `Field '${key}' should be a Yaml sequence. Got ${JSON.stringify(field)}`,
                  range: getRangeForError(parentMap, args),
              },
          };
}
