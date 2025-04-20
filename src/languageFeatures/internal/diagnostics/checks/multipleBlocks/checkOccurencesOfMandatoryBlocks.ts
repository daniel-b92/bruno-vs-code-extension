import { DiagnosticSeverity, Position, Range } from "vscode";
import {
    TextDocumentHelper,
    RequestFileBlock,
    RequestFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
} from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { DiagnosticWithCode } from "../../definitions";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: RequestFileBlock[]
): { toAdd: DiagnosticWithCode[]; toRemove: DiagnosticCode[] } {
    const toAdd: DiagnosticWithCode[] = [];
    const toRemove: DiagnosticCode[] = [];

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
        code: DiagnosticCode.MissingMetaBlock,
    };

    if (!blocks.some(({ name }) => name == RequestFileBlockName.Meta)) {
        toAdd.push(missingMetaBlockDiagnostic);
    } else {
        toRemove.push(DiagnosticCode.MissingMetaBlock);
    }

    // Exactly one method block needs to be defined
    const methodBlocks = getAllMethodBlocks(blocks);

    const incorrectNumberOfHttpMethodsDiagnostic: DiagnosticWithCode = {
        message: `Too many or too few HTTP method blocks defined. Exactly one of the following blocks needs to be present: '${getPossibleMethodBlocks().join(
            "', '"
        )}'`,
        range,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (methodBlocks.length != 1) {
        toAdd.push(incorrectNumberOfHttpMethodsDiagnostic);
    } else {
        toRemove.push(DiagnosticCode.IncorrectNumberofHttpMethodBlocks);
    }

    return { toAdd, toRemove };
}
