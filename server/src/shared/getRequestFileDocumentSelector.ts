import { DocumentSelector } from "vscode";
import { getExtensionForBrunoFiles } from "../../../client/src/shared";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: `**/*${getExtensionForBrunoFiles()}` };
}
