import { DocumentSelector } from "vscode";
import { getFileExtensionForFormat, CollectionFormat } from "@global_shared";

export function getRequestFileDocumentSelector(): DocumentSelector {
    return {
        scheme: "file",
        pattern: `**/*${getFileExtensionForFormat(CollectionFormat.Bru)}`,
    };
}
