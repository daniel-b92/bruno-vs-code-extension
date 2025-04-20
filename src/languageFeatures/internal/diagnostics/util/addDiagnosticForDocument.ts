import { DiagnosticCollection, Uri } from "vscode";
import { removeDiagnosticsForDocument } from "./removeDiagnosticsForDocument";
import { DiagnosticWithCode } from "../definitions";

export function addDiagnosticForDocument(
    documentUri: Uri,
    collection: DiagnosticCollection,
    toAdd: DiagnosticWithCode
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
    } else {
        const remainingDocumentDiagnostics = removeDiagnosticsForDocument(
            documentUri,
            collection,
            toAdd.code
        );

        collection.set(
            documentUri,
            remainingDocumentDiagnostics
                ? remainingDocumentDiagnostics.concat([toAdd])
                : [toAdd]
        );
    }
}
