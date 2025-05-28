import { DocumentSelector } from "vscode";
import { getExtensionForRequestFiles } from "../../../shared";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: `**/*${getExtensionForRequestFiles()}` };
}
