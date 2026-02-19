import {
    TextDocumentHelper,
    Block,
    RequestFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: Block[],
): DiagnosticWithCode[] {
    const result: DiagnosticWithCode[] = [];

    // Use full text of file as range for diagnostics
    const range = document.getTextRange();

    const missingMetaBlockDiagnostic: DiagnosticWithCode = {
        message: "No 'meta' block defined.",
        range,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.MissingMetaBlock,
    };

    if (!blocks.some(({ name }) => name == RequestFileBlockName.Meta)) {
        result.push(missingMetaBlockDiagnostic);
    }

    // Exactly one method block needs to be defined
    const methodBlocks = getAllMethodBlocks(blocks);

    const incorrectNumberOfHttpMethodsDiagnostic: DiagnosticWithCode = {
        message: `Too many or too few HTTP method blocks defined. Exactly one of the following blocks needs to be present: '${getPossibleMethodBlocks().join(
            "', '",
        )}'`,
        range,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (methodBlocks.length != 1) {
        result.push(incorrectNumberOfHttpMethodsDiagnostic);
    }

    return result;
}
