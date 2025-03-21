import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode";
import { TextDocumentHelper } from "../../../../shared/fileSystem/testFileParsing/definitions/textDocumentHelper";
import { DiagnosticCode } from "../diagnosticCodeEnum";

export function getDiagnosticForMetaBlockNotInFirstLine(
    document: TextDocumentHelper
): Diagnostic {
    return {
        message: "Should start with the 'meta' block",
        range: new Range(
            new Position(0, 0),
            new Position(0, document.getLineByIndex(0).length)
        ),
        severity: DiagnosticSeverity.Warning,
        code: DiagnosticCode.MetaBlockNotInFirstLine,
    };
}
