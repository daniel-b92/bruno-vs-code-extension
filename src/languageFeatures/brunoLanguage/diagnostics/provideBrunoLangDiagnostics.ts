import { DiagnosticCollection, TextDocument } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMissingMetaBlock } from "./providers/getDiagnosticForMissingMetaBlock";
import { getDiagnosticForMetaBlockNotInFirstLine } from "./providers/getDiagnosticForMetaBlockNotInFirstLine";
import { parseTestFile } from "../../../shared/fileSystem/testFileParsing/testFileParser";
import { RequestFileBlockName } from "../../../shared/fileSystem/testFileParsing/requestFileBlockNameEnum";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    document: TextDocument
) {
    const blocks = parseTestFile(document);
    
    // The 'meta' block is always mandatory
    if (!blocks.some(({ type }) => type == RequestFileBlockName.Meta)) {
        addDiagnosticForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document)
        );
    } else if (
        blocks.find(({ type }) => type == RequestFileBlockName.Meta)?.range
            .start.line != 0
    ) {
        removeDiagnosticsForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document)
        );
        addDiagnosticForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    } else {
        removeDiagnosticsForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document),
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    }
}
