import { DiagnosticCollection, Uri } from "vscode";
import { DiagnosticCode } from "../diagnosticCodeEnum";

export function removeDiagnosticsForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    ...toRemove: DiagnosticCode[]
) {
    const documentDiagnostics = collection.get(documentUri);

    if (documentDiagnostics) {
        collection.set(
            documentUri,
            documentDiagnostics.filter(
                (existing) => !toRemove.some((r) => existing.code == r)
            )
        );
    }
}
