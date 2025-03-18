import { Diagnostic, DiagnosticCollection, Uri } from "vscode";

export function removeDiagnosticsForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    ...toRemove: Diagnostic[]
) {
    const documentDiagnostics = collection.get(documentUri);

    if (documentDiagnostics) {
        collection.set(
            documentUri,
            documentDiagnostics.filter(
                (existing) => !toRemove.some((r) => existing.code == r.code)
            )
        );
    }
}
