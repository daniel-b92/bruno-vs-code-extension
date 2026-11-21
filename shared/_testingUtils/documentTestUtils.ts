import {
    CompletionItem,
    InsertTextFormat,
    TextEdit,
} from "vscode-languageserver";
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

/**
 * Applies the main edit and the additional edits of a completion item to the content.
 * Snippet placeholders are replaced by their default text, like editors do when the snippet is accepted.
 */
export function applyCompletionItem(content: string, item: CompletionItem) {
    const edits = [item.textEdit, ...(item.additionalTextEdits ?? [])]
        .filter((edit) => edit != undefined)
        .map((edit) =>
            item.insertTextFormat == InsertTextFormat.Snippet
                ? {
                      ...edit,
                      newText: getDefaultTextForSnippet(edit.newText),
                  }
                : edit,
        ) as TextEdit[];

    return applyTextEdits(content, edits);
}

function getDefaultTextForSnippet(snippetText: string) {
    return snippetText
        .replace(
            /(?<!\\)\$\{\d+\|([^}]*)\|}/g,
            (_match, choices: string) => choices.split(",")[0],
        )
        .replace(/(?<!\\)\$\{\d+:([^}]*)}/g, "$1")
        .replace(/(?<!\\)\$(?:\{\d+}|\d+)/g, "")
        .replace(/\\([$}\\])/g, "$1");
}
