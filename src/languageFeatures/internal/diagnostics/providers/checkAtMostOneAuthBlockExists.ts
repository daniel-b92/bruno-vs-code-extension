import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import { RequestFileBlock } from "../../../../shared";
import { addDiagnosticForDocument } from "../util/addDiagnosticForDocument";
import { DiagnosticCode } from "../diagnosticCodeEnum";
import { removeDiagnosticsForDocument } from "../util/removeDiagnosticsForDocument";
import { isAuthBlock } from "../../../../shared/fileSystem/testFileParsing/internal/isAuthBlock";
import { getSortedBlocksByPosition } from "../util/getSortedBlocksByPosition";

export function checkAtMostOneAuthBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[],
    diagnostics: DiagnosticCollection
) {
    const sortedAuthBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isAuthBlock(name))
    );

    if (sortedAuthBlocks.length > 1) {
        addDiagnosticForDocument(
            documentUri,
            diagnostics,
            getDiagnostic(documentUri, sortedAuthBlocks)
        );
    } else {
        removeDiagnosticsForDocument(
            documentUri,
            diagnostics,
            DiagnosticCode.TooManyAuthBlocksDefined
        );
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedAuthBlocks: RequestFileBlock[]
): Diagnostic {
    return {
        message: "Too many 'auth' blocks are defined.",
        range: getRange(sortedAuthBlocks),
        relatedInformation: sortedAuthBlocks.map(
            ({ name, nameRange }, index) => ({
                message: `Auth block definition no. ${
                    index + 1
                } with name '${name}'`,
                location: { uri: documentUri, range: nameRange },
            })
        ),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.TooManyAuthBlocksDefined,
    };
}

function getRange(sortedAuthBlocks: RequestFileBlock[]): Range {
    return new Range(
        sortedAuthBlocks[0].nameRange.start,
        sortedAuthBlocks[sortedAuthBlocks.length - 1].nameRange.end
    );
}
