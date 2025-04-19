import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode";
import { RequestFileBlock, TextDocumentHelper } from "../../../../../../shared";
import { DiagnosticCode } from "../../../diagnosticCodeEnum";

export function checkMetaBlockStartsInFirstLine(
    document: TextDocumentHelper,
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    if (metaBlock.nameRange.start.line != 0) {
        return getDiagnostic(document);
    } else {
        return DiagnosticCode.MetaBlockNotInFirstLine;
    }
}

function getDiagnostic(document: TextDocumentHelper) {
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
