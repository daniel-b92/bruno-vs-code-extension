import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Position,
    Range,
    Uri,
} from "vscode";
import { TextDocumentHelper } from "../../../../shared/fileSystem/testFileParsing/definitions/textDocumentHelper";
import { addDiagnosticForDocument } from "../util/addDiagnosticForDocument";
import { RequestFileBlock } from "../../../../shared/fileSystem/testFileParsing/definitions/interfaces";
import { DiagnosticCode } from "../diagnosticCodeEnum";
import { RequestFileBlockName } from "../../../../shared/fileSystem/testFileParsing/definitions/requestFileBlockNameEnum";
import { removeDiagnosticsForDocument } from "../util/removeDiagnosticsForDocument";

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

    // Some HTTP method block is mandatory
    const possibleHttpMethodBlocks: RequestFileBlockName[] = [
        RequestFileBlockName.Get,
        RequestFileBlockName.Put,
        RequestFileBlockName.Post,
        RequestFileBlockName.Delete,
        RequestFileBlockName.Patch,
        RequestFileBlockName.Head,
        RequestFileBlockName.Options,
    ];

    const missingHttpMethodBlocks = possibleHttpMethodBlocks.filter(
        (possibleName) =>
            !blocks.some(({ name: actualName }) => actualName == possibleName)
    );

    const incorrectNumberOfHttpMethodsDiagnostic: Diagnostic = {
        message: `Too many or too few HTTP method blocks defined. Exactly one of the following blocks needs to be present: '${possibleHttpMethodBlocks.join(
            "', '"
        )}'`,
        range,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.IncorrectNumberofHttpMethodBlocks,
    };

    if (missingHttpMethodBlocks.length != possibleHttpMethodBlocks.length - 1) {
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
