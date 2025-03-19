import { Diagnostic, DiagnosticSeverity, TextDocument } from "vscode";

export function getDiagnosticForMetaBlockNotInFirstLine(
    document: TextDocument
): Diagnostic {
    return {
        message: "Should start with the 'meta' block",
        range: document.lineAt(0).range,
        severity: DiagnosticSeverity.Warning,
        code: "bruLang_MetaBlockNotInFirstLine",
    };
}
