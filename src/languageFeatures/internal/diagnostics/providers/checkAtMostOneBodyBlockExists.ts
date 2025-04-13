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
import { getSortedBlocksByPosition } from "../util/getSortedBlocksByPosition";
import { isBodyBlock } from "../../../../shared/fileSystem/testFileParsing/internal/isBodyBlock";

export function checkAtMostOneBodyBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[],
    diagnostics: DiagnosticCollection
) {
    const sortedBodyBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isBodyBlock(name))
    );

    if (sortedBodyBlocks.length > 1) {
        addDiagnosticForDocument(
            documentUri,
            diagnostics,
            getDiagnostic(documentUri, sortedBodyBlocks)
        );
    } else {
        removeDiagnosticsForDocument(
            documentUri,
            diagnostics,
            DiagnosticCode.TooManyBodyBlocksDefined
        );
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBodyBlocks: RequestFileBlock[]
): Diagnostic {
    return {
        message: "Too many 'body' blocks are defined.",
        range: getRange(sortedBodyBlocks),
        relatedInformation: sortedBodyBlocks.map(
            ({ name, nameRange }, index) => ({
                message: `Body block definition no. ${
                    index + 1
                } with name '${name}'`,
                location: { uri: documentUri, range: nameRange },
            })
        ),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.TooManyBodyBlocksDefined,
    };
}

function getRange(sortedBodyBlocks: RequestFileBlock[]): Range {
    return new Range(
        sortedBodyBlocks[0].nameRange.start,
        sortedBodyBlocks[sortedBodyBlocks.length - 1].nameRange.end
    );
}
