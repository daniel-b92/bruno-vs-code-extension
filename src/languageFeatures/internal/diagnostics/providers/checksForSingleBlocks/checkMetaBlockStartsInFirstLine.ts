import {
    DiagnosticCollection,
    DiagnosticSeverity,
    Position,
    Range,
    Uri,
} from "vscode";
import { RequestFileBlock, TextDocumentHelper } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { addDiagnosticForDocument } from "../../util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "../../util/removeDiagnosticsForDocument";

export function checkMetaBlockStartsInFirstLine(
    document: TextDocumentHelper,
    metaBlock: RequestFileBlock,
    documentUri: Uri,
    existingDiagnostics: DiagnosticCollection
) {
    if (metaBlock.nameRange.start.line != 0) {
        addDiagnosticForDocument(
            documentUri,
            existingDiagnostics,
            getDiagnostic(document)
        );
    } else {
        removeDiagnosticsForDocument(
            documentUri,
            existingDiagnostics,
            DiagnosticCode.MetaBlockNotInFirstLine
        );
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
