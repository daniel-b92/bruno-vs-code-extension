import { Document } from "yaml";
import { FileInfoType, getInfoTypeFromYamlContent } from "@global_shared";

export function isYamlAppFile(
    text: string,
    /** If defined, it is used instead of parsing the text again. It needs to be the parsed text. */
    parsedDocument?: Document,
) {
    return getInfoTypeFromYamlContent(text, parsedDocument) == FileInfoType.App;
}
