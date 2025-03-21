import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import { addDiagnosticForDocument } from "../util/addDiagnosticForDocument";
import { TextOutsideOfBlocks } from "../../../../shared/fileSystem/testFileParsing/definitions/interfaces";
import { DiagnosticCode } from "../diagnosticCodeEnum";
import { removeDiagnosticsForDocument } from "../util/removeDiagnosticsForDocument";

export function checkThatNoTextExistsOutsideOfBlocks(
    documentUri: Uri,
    allTextOutsideOfBlocks: TextOutsideOfBlocks[],
    diagnostics: DiagnosticCollection
) {
    // Always remove diagnostic before trying to add it, to handle cases where changes are made in the document that cause more duplicate blocks than before.
    // Otherwise, the 'addDiagnosticForDocument' would just skip re-adding it since it already has been added.
    removeDiagnosticsForDocument(
        documentUri,
        diagnostics,
        DiagnosticCode.TextOutsideOfBlocks
    );

    const relevantTextOutsideOfBlocks = allTextOutsideOfBlocks.filter(
        ({ text }) => !/^\s*$/.test(text)
    );

    if (relevantTextOutsideOfBlocks.length > 0) {
        relevantTextOutsideOfBlocks.sort(
            (
                {
                    range: {
                        start: { line: line1 },
                    },
                },
                {
                    range: {
                        start: { line: line2 },
                    },
                }
            ) => line1 - line2
        );

        const range = new Range(
            relevantTextOutsideOfBlocks[0].range.start,
            relevantTextOutsideOfBlocks[
                relevantTextOutsideOfBlocks.length - 1
            ].range.end
        );

        const diagnostic: Diagnostic = {
            message: "Text outside of blocks is not allowed.",
            range,
            relatedInformation: relevantTextOutsideOfBlocks.map(
                ({ range }) => ({
                    message: `Text outside of blocks`,
                    location: {
                        uri: documentUri,
                        range,
                    },
                })
            ),
            severity: DiagnosticSeverity.Error,
            code: DiagnosticCode.MultipleDefinitionsForSameBlocks,
        };
        addDiagnosticForDocument(documentUri, diagnostics, diagnostic);
    }
}
