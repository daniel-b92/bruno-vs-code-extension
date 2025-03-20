import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode";
import { TextDocumentHelper } from "../../../../shared/fileSystem/testFileParsing/definitions/textDocumentHelper";

export function getDiagnosticForMissingMetaBlock(
    document: TextDocumentHelper
): Diagnostic {
    const lastLine = document.getLineByIndex(document.getLineCount() - 1);

    return {
        message: "No 'meta' block defined.",
        range: new Range(
            new Position(0, 0),
            new Position(document.getLineCount() - 1, lastLine.length)
        ),
        severity: DiagnosticSeverity.Error,
        code: "bruLang_MissingMetaBlock",
    };
}
