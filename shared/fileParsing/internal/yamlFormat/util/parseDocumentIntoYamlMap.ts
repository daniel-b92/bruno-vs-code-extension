import { LineCounter, parseDocument, YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { mapErrors } from "../parsingErrors/mapErrors";
import { getTopLevelMapIfExists } from "../yamlMaps/getTopLevelMapIfExists";
import { YamlParsingError } from "../../../external/yamlFormat/interfaces";

export function parseDocumentIntoYamlMap(
    commonArgs: CommonParsingArgs,
): { map: YAMLMap } | { errors: YamlParsingError[] } {
    const { fullDocumentRange, docHelper } = commonArgs;
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });

    if (document.errors.length > 0) {
        // Cannot continue with a technical parsing error.
        return { errors: mapErrors(document.errors, fullDocumentRange) };
    }

    const maybeTopLevelMap = getTopLevelMapIfExists({
        ...commonArgs,
        node: document.contents,
    });
    if ("error" in maybeTopLevelMap) {
        // Cannot continue, if the top level map is not valid.
        return { errors: [maybeTopLevelMap.error] };
    }

    return maybeTopLevelMap;
}
