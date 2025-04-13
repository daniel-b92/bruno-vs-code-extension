import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Position,
    Range,
    Uri,
} from "vscode";
import {
    TextDocumentHelper,
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../shared";
import { addDiagnosticForDocument } from "../../util/addDiagnosticForDocument";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { removeDiagnosticsForDocument } from "../../util/removeDiagnosticsForDocument";
import {
    getAllMethodBlocks,
    getPossibleMethodBlocks,
} from "../../../../../shared/fileSystem/testFileParsing/internal/getAllMethodBlocks";

export function checkOccurencesOfMandatoryBlocks(
    documentUri: Uri,
    document: TextDocumentHelper,
    blocks: RequestFileBlock[],
    diagnostics: DiagnosticCollection
) {
    // Use full text of file as range for diagnostics
    const range = new Range(
        new Position(0, 0),
        new Position(
            document.getLineCount() - 1,
            document.getLineByIndex(document.getLineCount() - 1).length
        )
    );

    const missingMetaBlockDiagnostic: Diagnostic = {
        message: "No 'meta' block defined.",
        range,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.MissingMetaBlock,
    };

    if (!blocks.some(({ name }) => name == RequestFileBlockName.Meta)) {
        addDiagnosticForDocument(
            documentUri,
            diagnostics,
            missingMetaBlockDiagnostic
        );
    } else {
        removeDiagnosticsForDocument(
            documentUri,
            diagnostics,
            DiagnosticCode.MissingMetaBlock
        );
    }

    // Exactly one method block needs to be defined
    const methodBlocks = getAllMethodBlocks(blocks);

    const incorrectNumberOfHttpMethodsDiagnostic: Diagnostic = {
        message: `Too many or too few HTTP method blocks defined. Exactly one of the following blocks needs to be present: '${getPossibleMethodBlocks().join(
            "', '"
        )}'`,
        range,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (methodBlocks.length != 1) {
        addDiagnosticForDocument(
            documentUri,
            diagnostics,
            incorrectNumberOfHttpMethodsDiagnostic
        );
    } else {
        removeDiagnosticsForDocument(
            documentUri,
            diagnostics,
            DiagnosticCode.IncorrectNumberofHttpMethodBlocks
        );
    }
}
