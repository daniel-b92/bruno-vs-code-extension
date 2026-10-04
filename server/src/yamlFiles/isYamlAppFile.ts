import { FileInfoType } from "@global_shared";
import { parseDocument } from "yaml";

export function isYamlAppFile(text: string) {
    // Invalid yaml syntax does not matter here, because it gets reported by the diagnostics for the file type that is assumed instead.
    return parseDocument(text).getIn(["info", "type"]) == FileInfoType.App;
}
