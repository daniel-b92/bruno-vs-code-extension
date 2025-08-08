import { DiagnosticSeverity } from "vscode";
import {
    TextDocumentHelper,
    Block,
    RequestFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
    mapRange,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: Block[]
): DiagnosticWithCode[] {
    const result: DiagnosticWithCode[] = [];

    // Use full text of file as range for diagnostics
    const range = document.getTextRange();

    const missingMetaBlockDiagnostic: DiagnosticWithCode = {
        message: "No 'meta' block defined.",
        range: mapRange(range),
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
            "', '"
        )}'`,
        range: mapRange(range),
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (methodBlocks.length != 1) {
        result.push(incorrectNumberOfHttpMethodsDiagnostic);
    }

    return result;
}
