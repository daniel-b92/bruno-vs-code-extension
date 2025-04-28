import { TextEditor, window } from "vscode";
import { getLineBreakForDocument } from "../../fileSystem/util/getLineBreakForDocument";
import { platform } from "os";

export function getLineBreak() {
    const textEditorForReference: TextEditor | undefined =
        window.activeTextEditor ?? window.visibleTextEditors[0];

    return textEditorForReference
        ? getLineBreakForDocument(textEditorForReference.document)
        : platform.name == "win32"
        ? "\r\n"
        : "\n";
}
export function getNumberOfWhitespacesForIndentation() {
    return 2;
}
