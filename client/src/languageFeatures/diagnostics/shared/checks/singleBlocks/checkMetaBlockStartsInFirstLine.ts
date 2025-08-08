import { DiagnosticSeverity, Position, Range } from "vscode";
import { Block, TextDocumentHelper } from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkMetaBlockStartsInFirstLine(
    document: TextDocumentHelper,
    metaBlock: Block
): DiagnosticWithCode | undefined {
    if (metaBlock.nameRange.start.line != 0) {
        return getDiagnostic(document);
    } else {
        return undefined;
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
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.MetaBlockNotInFirstLine;
}
