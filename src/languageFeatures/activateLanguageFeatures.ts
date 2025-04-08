import {
    DiagnosticCollection,
    ExtensionContext,
    languages,
    TextDocument,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import { provideBrunoLangDiagnostics } from "./internal/diagnostics/provideBrunoLangDiagnostics";
import { CollectionItemProvider } from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/util/isBrunoRequestFile";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        workspace.onDidOpenTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.uri.fsPath
                )
            ) {
                fetchDiagnostics(e, diagnosticCollection);
            }
        })
    );

    context.subscriptions.push(
        workspace.onDidChangeTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.document.uri.fsPath
                )
            ) {
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
