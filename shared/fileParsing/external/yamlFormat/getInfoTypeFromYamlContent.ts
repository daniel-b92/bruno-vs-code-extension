import { Document, isScalar, parseDocument } from "yaml";
import { FileInfoType } from "./constants/sharedConstants";

export function getInfoTypeFromYamlContent(
    text: string,
    /** If defined, it is used instead of parsing the text again. It needs to be the parsed text. */
    parsedDocument?: Document,
) {
    // Invalid yaml syntax does not matter here, because it gets reported by the diagnostics for the file type that is assumed instead.
    const type = (parsedDocument ?? parseDocument(text)).getIn([
        "info",
        "type",
    ]);

    return (Object.values(FileInfoType) as unknown[]).includes(type)
        ? (type as FileInfoType)
        : undefined;
}

/**
 * Returns the raw value of `info.type` (if it is a string) together with its start and end offset, regardless of whether it is a supported type.
 */
export function getRawInfoTypeFromYamlContent(text: string) {
    const node = parseDocument(text).getIn(["info", "type"], true);

    return isScalar(node) && typeof node.value == "string" && node.range
        ? {
              value: node.value,
              startOffset: node.range[0],
              endOffset: node.range[1],
          }
        : undefined;
}
