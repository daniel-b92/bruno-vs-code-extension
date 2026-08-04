import { isSeq, YAMLMap, YAMLSeq } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { fromYamlRange } from "../util/fromYamlRange";

export function getYamlSequenceByKeyFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { sequence: YAMLSeq<unknown> } | { error: YamlParsingError } {
    const { map: parentMap, key, fullDocumentRange, docHelper } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    const field = parentMap.get(key);
    return isSeq(field)
        ? { sequence: field }
        : {
              error: {
                  message: `Field '${key}' should be a Yaml sequence. Got ${JSON.stringify(field)}`,
                  range:
                      (parentMap.range
                          ? fromYamlRange(parentMap.range, docHelper)
                          : fullDocumentRange) ?? fullDocumentRange,
              },
          };
}
