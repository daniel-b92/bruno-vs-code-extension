import { FileInfoType, getInfoTypeFromYamlContent } from "@global_shared";

export function isYamlAppFile(text: string) {
    return getInfoTypeFromYamlContent(text) == FileInfoType.App;
}
