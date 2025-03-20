import { DiagnosticCollection, Uri } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMissingMetaBlock } from "./providers/getDiagnosticForMissingMetaBlock";
import { getDiagnosticForMetaBlockNotInFirstLine } from "./providers/getDiagnosticForMetaBlockNotInFirstLine";
import { parseTestFile } from "../../../shared/fileSystem/testFileParsing/testFileParser";
import { RequestFileBlockName } from "../../../shared/fileSystem/testFileParsing/definitions/requestFileBlockNameEnum";
import { TextDocumentHelper } from "../../../shared/fileSystem/testFileParsing/definitions/textDocumentHelper";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    documentText: string,
    uri: Uri
) {
    const document = new TextDocumentHelper(documentText);
    const blocks = parseTestFile(document);

    // The 'meta' block is always mandatory
    if (!blocks.some(({ name }) => name == RequestFileBlockName.Meta)) {
        addDiagnosticForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document)
        );
    } else if (
        blocks.find(({ name }) => name == RequestFileBlockName.Meta)?.nameRange
            .start.line != 0
    ) {
        removeDiagnosticsForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document)
        );
        addDiagnosticForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    } else {
        removeDiagnosticsForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaBlock(document),
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    }
}
