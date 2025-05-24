import {
    ExtensionContext,
    languages,
    TextDocument,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    Collection,
    CollectionItemProvider,
    parseBruFile,
    TextDocumentHelper,
} from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/shared/util/isBrunoRequestFile";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";
import { isBrunoEnvironmentFile } from "./internal/diagnostics/shared/util/isBrunoEnvironmentFile";
import { extname } from "path";
import { writeFileSync } from "fs";

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
        workspace.onDidOpenTextDocument((doc) => {
            if (extname(doc.fileName) == ".bru") {
                createTemporaryJsFile(doc.fileName, doc.getText());
            }

            fetchDiagnostics(
                doc,
                brunoLangDiagnosticsProvider,
                collectionItemProvider.getRegisteredCollections().slice()
            );
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (e.contentChanges.length > 0) {
                if (extname(e.document.fileName) == ".bru") {
                    createTemporaryJsFile(
                        e.document.fileName,
                        e.document.getText()
                    );
                }
                fetchDiagnostics(
                    e.document,
                    brunoLangDiagnosticsProvider,
                    collectionItemProvider.getRegisteredCollections().slice()
                );
            }
        }),
        workspace.onWillSaveTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.document.uri.fsPath
                ) &&
                window.activeTextEditor &&
                window.activeTextEditor.document.uri.toString() ==
                    e.document.uri.toString()
            ) {
                const { blocks: parsedBlocks } = parseBruFile(
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
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    registeredCollections: Collection[]
) {
    if (isBrunoRequestFile(registeredCollections, document.uri.fsPath)) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForRequestFile(
            document.uri,
            document.getText()
        );
    } else if (
        isBrunoEnvironmentFile(registeredCollections, document.uri.fsPath)
    ) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForEnvironmentFile(
            document.uri,
            document.getText()
        );
    }
}

function createTemporaryJsFile(bruFileName: string, bruFileContent: string) {
    writeFileSync(getVirtualJsFileName(bruFileName), bruFileContent);
}

function getVirtualJsFileName(bruFileName: string) {
    return bruFileName.replace(extname(bruFileName), ".js");
}
