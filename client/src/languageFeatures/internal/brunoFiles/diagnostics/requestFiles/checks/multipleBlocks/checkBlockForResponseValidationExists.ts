import { DiagnosticSeverity, Position, Range } from "vscode";
import {
    Block,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkBlockForResponseValidationExists(
    documentHelper: TextDocumentHelper,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    if (
        blocks.filter(
            ({ name }) =>
                name == RequestFileBlockName.Tests ||
                name == RequestFileBlockName.Assertions ||
                name == RequestFileBlockName.PostResponseScript,
        ).length == 0
    ) {
        return getDiagnostic(documentHelper);
    } else {
        return undefined;
    }
}

function getDiagnostic(documentHelper: TextDocumentHelper): DiagnosticWithCode {
    const lastLine = documentHelper.getLineByIndex(
        documentHelper.getLineCount() - 1,
    );

    return {
        message: `No '${RequestFileBlockName.Assertions}', '${RequestFileBlockName.PostResponseScript}' or '${RequestFileBlockName.Tests}' block is defined.`,
        range: new Range(
            new Position(documentHelper.getLineCount() - 1, 0),
            new Position(documentHelper.getLineCount() - 1, lastLine.length),
        ),
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.NoBlockForResponseValidationDefined,
    };
}
