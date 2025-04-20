import { DiagnosticCollection, Uri } from "vscode";
import { KnownDiagnosticCode } from "../diagnosticCodes/knownDiagnosticCodeEnum";

export function removeDiagnosticsForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    ...toRemove: KnownDiagnosticCode[]
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

    return collection.get(documentUri);
}
