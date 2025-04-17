import { Diagnostic, DiagnosticCollection, Uri } from "vscode";
import { removeDiagnosticsForDocument } from "./removeDiagnosticsForDocument";
import { DiagnosticCode } from "../diagnosticCodeEnum";

export function addDiagnosticForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    toAdd: Diagnostic,
) {
    const initialDocumentDiagnostics = collection.get(documentUri);

    if (!initialDocumentDiagnostics || initialDocumentDiagnostics.length == 0) {
        collection.set(documentUri, [toAdd]);
        return;
    }

    const alreadyExists = initialDocumentDiagnostics.some(
        (d) => d.code == toAdd.code
    );

    if (!alreadyExists) {
        collection.set(documentUri, initialDocumentDiagnostics.concat([toAdd]));
    } else if (
        toAdd.code &&
        Object.values(DiagnosticCode).some(
            (knownCodes) => knownCodes == toAdd.code
        )
    ) {
        removeDiagnosticsForDocument(
            documentUri,
            collection,
            toAdd.code as DiagnosticCode
        );

        collection.set(documentUri, initialDocumentDiagnostics.concat([toAdd]));
    }
}
