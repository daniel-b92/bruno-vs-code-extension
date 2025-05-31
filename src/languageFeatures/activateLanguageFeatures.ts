import {
    ExtensionContext,
    languages,
    TabInputText,
    TextDocument,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    Collection,
    CollectionItemProvider,
    normalizeDirectoryPath,
    parseBruFile,
    TextDocumentHelper,
} from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/shared/util/isBrunoRequestFile";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";
import { isBrunoEnvironmentFile } from "./internal/diagnostics/shared/util/isBrunoEnvironmentFile";
import { createTemporaryJsFile } from "./internal/shared/codeBlocksUtils/createTemporaryJsFile";
import { TemporaryJsFilesRegistry } from "./internal/shared/temporaryJsFilesRegistry";
import { deleteTemporaryJsFileForCollection } from "./internal/shared/codeBlocksUtils/deleteTemporaryJsFile";
import { provideInfosOnHover } from "./internal/hover/provideInfosOnHover";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems(collectionItemProvider);
    provideInfosOnHover(collectionItemProvider);

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );
    const tempJsFilesRegistry = new TemporaryJsFilesRegistry();

    context.subscriptions.push(
        brunoLangDiagnosticsProvider,
        tempJsFilesRegistry,
        window.onDidChangeActiveTextEditor((editor) => {
            if (
                !editor ||
                !window.tabGroups.activeTabGroup.activeTab ||
                !(
                    window.tabGroups.activeTabGroup.activeTab.input instanceof
                    TabInputText
                )
            ) {
                for (const collecton of tempJsFilesRegistry.getCollectionsWithRegisteredJsFiles()) {
                    deleteTemporaryJsFileForCollection(
                        tempJsFilesRegistry,
                        collecton
                    );
                }
            } else if (
                editor.document.uri.toString() ==
                window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
            ) {
                fetchDiagnostics(
                    editor.document,
                    brunoLangDiagnosticsProvider,
                    collectionItemProvider.getRegisteredCollections().slice()
                );

                if (
                    isBrunoRequestFile(
                        collectionItemProvider
                            .getRegisteredCollections()
                            .slice(),
                        editor.document.uri.fsPath
                    )
                ) {
                    createTemporaryJsFile(
                        (
                            collectionItemProvider.getAncestorCollectionForPath(
                                editor.document.fileName
                            ) as Collection
                        ).getRootDirectory(),
                        tempJsFilesRegistry,
                        editor.document.getText()
                    );
                } else {
                    for (const collection of tempJsFilesRegistry.getCollectionsWithRegisteredJsFiles()) {
                        deleteTemporaryJsFileForCollection(
                            tempJsFilesRegistry,
                            collection
                        );
                    }
                }
            }
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (e.contentChanges.length > 0) {
                if (
                    isBrunoRequestFile(
                        collectionItemProvider
                            .getRegisteredCollections()
                            .slice(),
                        e.document.uri.fsPath
                    ) &&
                    // If the document has been modified externally (not via VS Code), skip all actions
                    window.activeTextEditor?.document.uri.toString() ==
                        e.document.uri.toString()
                ) {
                    createTemporaryJsFile(
                        (
                            collectionItemProvider.getAncestorCollectionForPath(
                                e.document.fileName
                            ) as Collection
                        ).getRootDirectory(),
                        tempJsFilesRegistry,
                        e.document.getText()
                    );

                    fetchDiagnostics(
                        e.document,
                        brunoLangDiagnosticsProvider,
                        collectionItemProvider
                            .getRegisteredCollections()
                            .slice()
                    );
                }
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
                    tempJsFilesRegistry
                        .getCollectionsWithRegisteredJsFiles()
                        .map((registered) => normalizeDirectoryPath(registered))
                        .includes(
                            normalizeDirectoryPath(
                                collection.getRootDirectory()
                            )
                        )
                ) {
                    deleteTemporaryJsFileForCollection(
                        tempJsFilesRegistry,
                        collection.getRootDirectory()
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
