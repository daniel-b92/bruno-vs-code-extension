import { DocumentSelector } from "vscode";
import { getExtensionForBrunoFiles } from "@global_shared";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: `**/*${getExtensionForBrunoFiles()}` };
}
