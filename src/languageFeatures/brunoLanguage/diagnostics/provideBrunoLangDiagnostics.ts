import { DiagnosticCollection, Uri } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMetaBlockNotInFirstLine } from "./providers/getDiagnosticForMetaBlockNotInFirstLine";
import { parseTestFile } from "../../../shared/fileSystem/testFileParsing/testFileParser";
import { RequestFileBlockName } from "../../../shared/fileSystem/testFileParsing/definitions/requestFileBlockNameEnum";
import { TextDocumentHelper } from "../../../shared/fileSystem/testFileParsing/definitions/textDocumentHelper";
import { checkOccurencesOfMandatoryBlocks } from "./providers/checkOccurencesOfMandatoryBlocks";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    documentText: string,
    uri: Uri
) {
    const document = new TextDocumentHelper(documentText);
    const blocks = parseTestFile(document);

    const missingBlocks = checkOccurencesOfMandatoryBlocks(
        uri,
        document,
        blocks,
        diagnosticCollection
    );

    if (
        !missingBlocks.includes(RequestFileBlockName.Meta) &&
        blocks.find(({ name }) => name == RequestFileBlockName.Meta)?.nameRange
            .start.line != 0
    ) {
        addDiagnosticForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    } else {
        removeDiagnosticsForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    }
}
