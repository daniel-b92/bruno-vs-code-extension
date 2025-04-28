import {
    ExtensionContext,
    languages,
    TextDocument,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    CollectionItemProvider,
    parseTestFile,
    TextDocumentHelper,
} from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/util/isBrunoRequestFile";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );

    context.subscriptions.push(
        brunoLangDiagnosticsProvider,
        workspace.onDidOpenTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.uri.fsPath
                )
            ) {
                fetchDiagnostics(e, brunoLangDiagnosticsProvider);
            }
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (
                e.contentChanges.length > 0 &&
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.document.uri.fsPath
                )
            ) {
                fetchDiagnostics(e.document, brunoLangDiagnosticsProvider);
            }
        }),
        workspace.onWillSaveTextDocument((e) => {
            if (
                window.activeTextEditor &&
                window.activeTextEditor.document.uri.toString() ==
                    e.document.uri.toString()
            ) {
                const { blocks: parsedBlocks } = parseTestFile(
                    new TextDocumentHelper(e.document.getText())
                );

                window.activeTextEditor.edit((editBuilder) => {
                    updateUrlToMatchQueryParams(editBuilder, parsedBlocks);
                    updatePathParamsKeysToMatchUrl(
                        e.document,
                        editBuilder,
                        parsedBlocks
                    );
                });
            }
        })
    );
}

function fetchDiagnostics(
    document: TextDocument,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider
) {
    brunoLangDiagnosticsProvider.provideDiagnostics(
        document.uri,
        document.getText()
    );
}
