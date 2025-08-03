import { EndOfLine, TextDocument, workspace } from "vscode";
import { getLineBreakFromSettings } from "../..";

export function getLineBreak(referenceFile?: string | TextDocument) {
    if (referenceFile) {
        const document =
            typeof referenceFile == "string"
                ? workspace.textDocuments.find(
                      ({ fileName: docPath }) => referenceFile == docPath,
                  )
                : referenceFile;

        return document
            ? (getLineBreakForFile(document) ?? getLineBreakFromSettings())
            : getLineBreakFromSettings();
    }

    return getLineBreakFromSettings();
}

function getLineBreakForFile(document: TextDocument) {
    return document
        ? document.eol == EndOfLine.LF
            ? "\n"
            : "\r\n"
        : undefined;
}
