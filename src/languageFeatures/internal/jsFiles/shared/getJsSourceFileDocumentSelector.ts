import { DocumentSelector } from "vscode";
import { getTemporaryJsFileBasename } from "../../../../shared";

export function getJsSourceFileDocumentSelector(): DocumentSelector {
    const tempJsFileBasename = getTemporaryJsFileBasename();

    // Avoid matching the temp js file because for this file, the real typescript server language features are needed.
    return {
        scheme: "file",
        pattern: `**/[!${tempJsFileBasename.substring(0, tempJsFileBasename.indexOf("."))}]*.js`,
    };
}
