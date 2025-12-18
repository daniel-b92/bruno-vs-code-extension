import { DocumentSelector } from "vscode";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: "**/*.js" };
}
