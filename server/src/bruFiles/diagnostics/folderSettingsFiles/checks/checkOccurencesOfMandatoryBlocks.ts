import {
    TextDocumentHelper,
    Block,
    RequestFileBlockName,
} from "@global_shared";
import { DiagnosticWithCode } from "../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

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
        range: document.getTextRange(), // Use full text of file as range for diagnostics
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.MissingMetaBlock,
    };
}
