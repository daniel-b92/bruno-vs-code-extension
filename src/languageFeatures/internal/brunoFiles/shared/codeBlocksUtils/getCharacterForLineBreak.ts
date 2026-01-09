import { EndOfLine } from "vscode";

export function getCharacterForLineBreak(eol: EndOfLine) {
    return eol == EndOfLine.LF ? "\n" : "\r\n";
}
