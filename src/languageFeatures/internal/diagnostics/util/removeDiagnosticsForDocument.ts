import { Diagnostic, DiagnosticCollection, Uri } from "vscode";
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

    return documentDiagnostics
        ? documentDiagnostics.length -
              (collection.get(documentUri)
                  ? (collection.get(documentUri) as readonly Diagnostic[])
                        .length
                  : 0)
        : 0;
}
