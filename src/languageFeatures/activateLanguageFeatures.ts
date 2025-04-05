import {
    DiagnosticCollection,
    ExtensionContext,
    languages,
    TextDocument,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import { provideBrunoLangDiagnostics } from "./internal/diagnostics/provideBrunoLangDiagnostics";
import { OpenDocumentState } from "./internal/state/openDocumentState";
import { CollectionItemProvider } from "../shared";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    const openDocumentState = new OpenDocumentState();

    context.subscriptions.push(
        workspace.onDidOpenTextDocument(async (e) => {
            if (
                await openDocumentState.isDocumentBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections(),
                    e.uri
                )
            ) {
                fetchDiagnostics(e, diagnosticCollection);
            }
        })
    );

    context.subscriptions.push(
        workspace.onDidChangeTextDocument((e) => {
            if (openDocumentState.isCurrentDocumentRequestFile()) {
                fetchDiagnostics(e.document, diagnosticCollection);
            }
        })
    );
}

function fetchDiagnostics(
    document: TextDocument,
    knownDiagnostics: DiagnosticCollection
) {
    provideBrunoLangDiagnostics(
        knownDiagnostics,
        document.getText(),
        document.uri
    );
}
