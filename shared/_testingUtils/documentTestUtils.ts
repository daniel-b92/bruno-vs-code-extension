import { TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    BrunoFileType,
    getRequestTypeField,
    parseBruFile,
    Position,
    Range,
    TextDocumentHelper,
} from "..";

export function getDummyRange() {
    return new Range(new Position(0, 0), new Position(0, 0));
}

export function parseBlocksFromRequestFileContent(content: string) {
    return parseBruFile(
        new TextDocumentHelper(content),
        BrunoFileType.RequestFile,
    ).blocks;
}

export function getRequestTypeFieldFromRequestFileContent(content: string) {
    return getRequestTypeField(parseBlocksFromRequestFileContent(content));
}

export function applyTextEdits(content: string, edits: TextEdit[]) {
    return TextDocument.applyEdits(
        TextDocument.create("file:///test", "plaintext", 1, content),
        edits,
    );
}
