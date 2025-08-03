import { EndOfLine, workspace } from "vscode";
import { getLineBreakFromSettings } from "../..";

export function getLineBreak(referenceFile?: string) {
    if (referenceFile) {
        return getLineBreakForFile(referenceFile) ?? getLineBreakFromSettings();
    }

    return getLineBreakFromSettings();
}

function getLineBreakForFile(filePath: string) {
    const document = workspace.textDocuments.find(
        ({ fileName: docPath }) => filePath == docPath,
    );

    return document
        ? document.eol == EndOfLine.LF
            ? "\n"
            : "\r\n"
        : undefined;
}
