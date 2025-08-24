import { DocumentSelector } from "vscode";

export function getJsFileDocumentSelector(): DocumentSelector {
    return {
        scheme: "file",
        pattern: "**/*.js",
    };
}
