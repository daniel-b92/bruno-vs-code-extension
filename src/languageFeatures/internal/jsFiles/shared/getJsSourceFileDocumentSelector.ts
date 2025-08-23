import { DocumentSelector } from "vscode";
import { getTemporaryJsFileBasenameWithoutExtension } from "../../../../shared";

export function getJsSourceFileDocumentSelector(): DocumentSelector {
    // Avoid matching the temp js file because for this file, the real typescript server language features are needed.
    return {
        scheme: "file",
        pattern: `**/[!${getTemporaryJsFileBasenameWithoutExtension()}]*.js`,
    };
}
