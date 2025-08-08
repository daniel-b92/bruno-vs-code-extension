import { DocumentSelector } from "vscode";
import { getExtensionForBrunoFiles } from "../../../shared";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: `**/*${getExtensionForBrunoFiles()}` };
}
