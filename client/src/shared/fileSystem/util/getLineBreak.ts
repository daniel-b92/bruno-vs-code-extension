import { EndOfLine, TextDocument, workspace } from "vscode";
import { getLineBreakFromSettings } from "../..";

export enum LineBreakType {
    Lf = "\n",
    Crlf = "\r\n"
}

export function getLineBreak(referenceFile?: string | TextDocument): LineBreakType {
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
            ? LineBreakType.Lf
            : LineBreakType.Crlf
        : undefined;
}
