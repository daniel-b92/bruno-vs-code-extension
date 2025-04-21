import { DiagnosticSeverity, Position, Range } from "vscode";
import {
    TextDocumentHelper,
    RequestFileBlock,
    RequestFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: RequestFileBlock[]
): DiagnosticWithCode[] {
    const result: DiagnosticWithCode[] = [];

    // Use full text of file as range for diagnostics
    const range = new Range(
        new Position(0, 0),
        new Position(
            document.getLineCount() - 1,
            document.getLineByIndex(document.getLineCount() - 1).length
        )
    );

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
            "', '"
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
