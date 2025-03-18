import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Range,
    TextDocument,
    Uri,
} from "vscode";

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

function getDiagnosticForMissingMetaSection(
    document: TextDocument
): Diagnostic {
    return {
        message: "No 'meta' section defined.",
        range: new Range(
            document.positionAt(0),
            document.lineAt(document.lineCount - 1).range.end
        ),
        severity: DiagnosticSeverity.Error,
        code: "bruLang_MissingMetaSection",
    };
}

function getDiagnosticForMetaSectionNotInFirstLine(
    document: TextDocument
): Diagnostic {
    return {
        message: "Should start with the 'meta' section",
        range: document.lineAt(0).range,
        severity: DiagnosticSeverity.Warning,
        code: "bruLang_MetaSectionNotInFirstLine",
    };
}

function addDiagnosticForDocument(
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

function removeDiagnosticsForDocument(
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

function hasMetaSection(document: TextDocument) {
    return document
        .getText()
        .split(/\n/)
        .some((line) => line.match(/^\s*meta\s*{\s*$/));
}
