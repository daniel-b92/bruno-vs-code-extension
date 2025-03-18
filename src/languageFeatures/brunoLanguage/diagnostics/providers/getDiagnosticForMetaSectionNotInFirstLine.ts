import { Diagnostic, DiagnosticSeverity, TextDocument } from "vscode";

export function getDiagnosticForMetaSectionNotInFirstLine(
    document: TextDocument
): Diagnostic {
    return {
        message: "Should start with the 'meta' section",
        range: document.lineAt(0).range,
        severity: DiagnosticSeverity.Warning,
        code: "bruLang_MetaSectionNotInFirstLine",
    };
}
