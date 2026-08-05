import { isMap, YAMLMap } from "yaml";
import { YamlParsingError } from "../../../..";
import { CommonParsingArgs } from "../interfaces";

export function getTopLevelMapIfExists({
    node,
    fullDocumentRange,
}: CommonParsingArgs & { node: unknown }):
    { map: YAMLMap<unknown, unknown> } | { error: YamlParsingError } {
    return isMap(node)
        ? { map: node }
        : {
              error: {
                  message: "A top level Yaml map is required",
                  range: fullDocumentRange,
              },
          };
}
