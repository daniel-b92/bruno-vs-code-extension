import { DiagnosticSeverity } from "vscode";
import {
    TextDocumentHelper,
    Block,
    RequestFileBlockName,
    mapToVsCodeRange,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    return blocks.some(({ name }) => name == RequestFileBlockName.Meta)
        ? undefined
        : getDiagnostic(document);
}

function getDiagnostic(document: TextDocumentHelper): DiagnosticWithCode {
    return {
        message: "No 'meta' block defined.",
        range: mapToVsCodeRange(document.getTextRange()), // Use full text of file as range for diagnostics
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.MissingMetaBlock,
    };
}
