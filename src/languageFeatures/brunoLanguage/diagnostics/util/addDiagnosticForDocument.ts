import { Diagnostic, DiagnosticCollection, Uri } from "vscode";

export function addDiagnosticForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    toAdd: Diagnostic
) {
    const documentDiagnostics = collection.get(documentUri);

    if (!documentDiagnostics || documentDiagnostics.length == 0) {
        collection.set(documentUri, [toAdd]);
    } else if (!documentDiagnostics.some((d) => d.code == toAdd.code)) {
        collection.set(documentUri, documentDiagnostics.concat([toAdd]));
    }
}