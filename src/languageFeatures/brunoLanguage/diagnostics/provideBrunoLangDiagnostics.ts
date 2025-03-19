import { DiagnosticCollection, TextDocument } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMissingMetaSection } from "./providers/getDiagnosticForMissingMetaSection";
import { getDiagnosticForMetaSectionNotInFirstLine } from "./providers/getDiagnosticForMetaSectionNotInFirstLine";
import { parseTestFile } from "../../../shared/fileSystem/testFileParsing/testFileParser";
import { RequestFileSectionName } from "../../../shared/fileSystem/testFileParsing/requestFileSectionNameEnum";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    document: TextDocument
) {
    const sections = parseTestFile(document);
    
    // The 'meta' section is always mandatory
    if (!sections.some(({ type }) => type == RequestFileSectionName.Meta)) {
        addDiagnosticForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaSection(document)
        );
    } else if (
        sections.find(({ type }) => type == RequestFileSectionName.Meta)?.range
            .start.line != 0
    ) {
        removeDiagnosticsForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaSection(document)
        );
        addDiagnosticForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMetaSectionNotInFirstLine(document)
        );
    } else {
        removeDiagnosticsForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaSection(document),
            getDiagnosticForMetaSectionNotInFirstLine(document)
        );
    }
}
