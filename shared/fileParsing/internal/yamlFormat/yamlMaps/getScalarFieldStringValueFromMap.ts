import { YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { fromYamlRange } from "../util/fromYamlRange";

export function getScalarFieldStringValueFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { value: string } | { fieldExists: boolean; error: YamlParsingError } {
    const { map, key, fullDocumentRange, docHelper, isTopLevelMap } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { fieldExists: false, error: existenceError };
    }

    const field = map.get(key);
    return typeof field == "string"
        ? { value: field }
        : {
              fieldExists: true,
              error: {
                  message: `Field '${key}' should be a string.`,
                  range: isTopLevelMap
                      ? fullDocumentRange
                      : ((map.range
                            ? fromYamlRange(map.range, docHelper)
                            : fullDocumentRange) ?? fullDocumentRange),
              },
          };
}
