import { DiagnosticSeverity, Position, Range } from "vscode";
import {
    Block,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkEitherAssertOrTestsBlockExists(
    documentHelper: TextDocumentHelper,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    if (
        blocks.filter(
            ({ name }) =>
                name == RequestFileBlockName.Tests ||
                name == RequestFileBlockName.Assertions
        ).length == 0
    ) {
        return getDiagnostic(documentHelper);
    } else {
        return undefined;
    }
}

function getDiagnostic(documentHelper: TextDocumentHelper): DiagnosticWithCode {
    const lastLine = documentHelper.getLineByIndex(
        documentHelper.getLineCount() - 1
    );

    return {
        message: `No '${RequestFileBlockName.Assertions}' or '${RequestFileBlockName.Tests}' block is defined.`,
        range: new Range(
            new Position(documentHelper.getLineCount() - 1, 0),
            new Position(documentHelper.getLineCount() - 1, lastLine.length)
        ),
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.NoAssertOrTestsBlockDefined,
    };
}
