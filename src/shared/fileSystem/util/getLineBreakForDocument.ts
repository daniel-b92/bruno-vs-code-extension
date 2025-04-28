import { EndOfLine, TextDocument } from "vscode";

export function getLineBreakForDocument(document: TextDocument) {
    return document.eol == EndOfLine.LF ? "\n" : "\r\n";
}
