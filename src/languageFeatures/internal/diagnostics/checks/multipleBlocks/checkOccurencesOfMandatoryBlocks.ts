import { DiagnosticSeverity, Position, Range } from "vscode";
import {
    TextDocumentHelper,
    RequestFileBlock,
    RequestFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { MethodBlockSpecificDiagnosticCode } from "../../diagnosticCodes/methodBlockSpecificDiagnosticCodeEnum";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeEnum";
import { MetaBlockSpecificDiagnosticCode } from "../../diagnosticCodes/metaBlockSpecificDiagnosticCodeEnum";

export function checkOccurencesOfMandatoryBlocks(
    document: TextDocumentHelper,
    blocks: RequestFileBlock[]
): { toAdd: DiagnosticWithCode[]; toRemove: KnownDiagnosticCode[] } {
    const toAdd: DiagnosticWithCode[] = [];
    const toRemove: KnownDiagnosticCode[] = [];

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
        code: MetaBlockSpecificDiagnosticCode.MissingMetaBlock,
    };

    if (!blocks.some(({ name }) => name == RequestFileBlockName.Meta)) {
        toAdd.push(missingMetaBlockDiagnostic);
    } else {
        toRemove.push(MetaBlockSpecificDiagnosticCode.MissingMetaBlock);
    }

    // Exactly one method block needs to be defined
    const methodBlocks = getAllMethodBlocks(blocks);

    const incorrectNumberOfHttpMethodsDiagnostic: DiagnosticWithCode = {
        message: `Too many or too few HTTP method blocks defined. Exactly one of the following blocks needs to be present: '${getPossibleMethodBlocks().join(
            "', '"
        )}'`,
        range,
        severity: DiagnosticSeverity.Error,
        code: MethodBlockSpecificDiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (methodBlocks.length != 1) {
        toAdd.push(incorrectNumberOfHttpMethodsDiagnostic);
    } else {
        toRemove.push(
            MethodBlockSpecificDiagnosticCode.IncorrectNumberofHttpMethodBlocks
        );
    }

    return { toAdd, toRemove };
}
