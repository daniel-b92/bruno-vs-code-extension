import { parseDocument } from "yaml";
import { FileInfoType } from "./constants/sharedConstants";

export function getInfoTypeFromYamlContent(text: string) {
    // Invalid yaml syntax does not matter here, because it gets reported by the diagnostics for the file type that is assumed instead.
    const type = parseDocument(text).getIn(["info", "type"]);

    return (Object.values(FileInfoType) as unknown[]).includes(type)
        ? (type as FileInfoType)
        : undefined;
}
