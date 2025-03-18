import { DiagnosticCollection, TextDocument } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMissingMetaSection } from "./providers/getDiagnosticForMissingMetaSection";
import { getDiagnosticForMetaSectionNotInFirstLine } from "./providers/getDiagnosticForMetaSectionNotInFirstLine";
import { hasMetaSection } from "../../../shared/fileSystem/testFileParsing/testFileParser";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    document: TextDocument
) {
    if (!hasMetaSection(document)) {
        addDiagnosticForDocument(
            document.uri,
            diagnosticCollection,
            getDiagnosticForMissingMetaSection(document)
        );
    } else if (!document.lineAt(0).text.match(/^\s*meta\s*{\s*$/)) {
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
