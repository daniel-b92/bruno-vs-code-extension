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
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { getVirtualJsFileName } from "./internal/shared/getVirtualJsFileName";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems(collectionItemProvider);

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );

    context.subscriptions.push(
        brunoLangDiagnosticsProvider,
        workspace.onDidOpenTextDocument((doc) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    doc.uri.fsPath
                )
            ) {
                createTemporaryJsFile(
                    (
                        collectionItemProvider.getAncestorCollectionForPath(
                            doc.fileName
                        ) as Collection
                    ).getRootDirectory(),
                    doc.fileName,
                    doc.getText()
                );
            }

            fetchDiagnostics(
                doc,
                brunoLangDiagnosticsProvider,
                collectionItemProvider.getRegisteredCollections().slice()
            );
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (e.contentChanges.length > 0) {
                if (
                    isBrunoRequestFile(
                        collectionItemProvider
                            .getRegisteredCollections()
                            .slice(),
                        e.document.uri.fsPath
                    )
                ) {
                    createTemporaryJsFile(
                        (
                            collectionItemProvider.getAncestorCollectionForPath(
                                e.document.fileName
                            ) as Collection
                        ).getRootDirectory(),
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
                )
            ) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        e.document.fileName
                    );
                if (
                    collection &&
                    existsSync(
                        getVirtualJsFileName(
                            collection.getRootDirectory(),
                            e.document.uri.fsPath
                        )
                    )
                ) {
                    unlinkSync(
                        getVirtualJsFileName(
                            collection.getRootDirectory(),
                            e.document.uri.fsPath
                        )
                    );
                }

                if (
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
            }
        }),
        workspace.onDidCloseTextDocument((doc) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    doc.uri.fsPath
                )
            ) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        doc.uri.fsPath
                    ) as Collection;
                if (
                    existsSync(
                        getVirtualJsFileName(
                            collection.getRootDirectory(),
                            doc.uri.fsPath
                        )
                    )
                ) {
                    unlinkSync(
                        getVirtualJsFileName(
                            collection.getRootDirectory(),
                            doc.uri.fsPath
                        )
                    );
                }
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

function createTemporaryJsFile(
    collectionRootDirectory: string,
    bruFileName: string,
    bruFileContent: string
) {
    writeFileSync(
        getVirtualJsFileName(collectionRootDirectory, bruFileName),
        bruFileContent
    );
}
