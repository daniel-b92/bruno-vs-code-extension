import { Diagnostic, DiagnosticSeverity, Range, TextDocument } from "vscode";

export function getDiagnosticForMissingMetaSection(
    document: TextDocument
): Diagnostic {
    return {
        message: "No 'meta' section defined.",
        range: new Range(
            document.positionAt(0),
            document.lineAt(document.lineCount - 1).range.end
        ),
        severity: DiagnosticSeverity.Error,
        code: "bruLang_MissingMetaSection",
    };
}
