import {
    ExtensionContext,
    languages,
    TabInputText,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentWillSaveEvent,
    TextEditor,
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
import { provideCodeBlocksCompletionItems } from "./internal/completionItems/provideCodeBlocksCompletionItems";
import { provideInfosOnHover } from "./internal/hover/provideInfosOnHover";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    const tempJsFilesRegistry = new TemporaryJsFilesRegistry();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );

    context.subscriptions.push(
        diagnosticCollection,
        tempJsFilesRegistry,
        ...provideBrunoLangCompletionItems(),
        provideCodeBlocksCompletionItems(
            collectionItemProvider,
            tempJsFilesRegistry
        ),
        provideInfosOnHover(collectionItemProvider, tempJsFilesRegistry),
        brunoLangDiagnosticsProvider,
        tempJsFilesRegistry,
        window.onDidChangeActiveTextEditor((editor) => {
            onDidChangeActiveTextEditor(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                editor
            );
        }),
        workspace.onDidChangeTextDocument((e) => {
            onDidChangeTextDocument(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                e
            );
        }),
        workspace.onWillSaveTextDocument((e) => {
            onWillSaveTextDocument(
                tempJsFilesRegistry,
                collectionItemProvider,
                e
            );
        })
    );
}

function onDidChangeActiveTextEditor(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    editor: TextEditor | undefined
) {
    if (
        !editor ||
        !window.tabGroups.activeTabGroup.activeTab ||
        !(
            window.tabGroups.activeTabGroup.activeTab.input instanceof
            TabInputText
        )
    ) {
        for (const collecton of tempJsFilesRegistry.getCollectionsWithRegisteredJsFiles()) {
            deleteTemporaryJsFileForCollection(tempJsFilesRegistry, collecton);
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
                collectionItemProvider.getRegisteredCollections().slice(),
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
}

function onDidChangeTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentChangeEvent
) {
    if (event.contentChanges.length > 0) {
        if (
            isBrunoRequestFile(
                collectionItemProvider.getRegisteredCollections().slice(),
                event.document.uri.fsPath
            ) &&
            // If the document has been modified externally (not via VS Code), skip all actions
            window.activeTextEditor?.document.uri.toString() ==
                event.document.uri.toString()
        ) {
            createTemporaryJsFile(
                (
                    collectionItemProvider.getAncestorCollectionForPath(
                        event.document.fileName
                    ) as Collection
                ).getRootDirectory(),
                tempJsFilesRegistry,
                event.document.getText()
            );

            fetchDiagnostics(
                event.document,
                brunoLangDiagnosticsProvider,
                collectionItemProvider.getRegisteredCollections().slice()
            );
        }
    }
}

function onWillSaveTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentWillSaveEvent
) {
    if (
        isBrunoRequestFile(
            collectionItemProvider.getRegisteredCollections().slice(),
            event.document.uri.fsPath
        )
    ) {
        const collection = collectionItemProvider.getAncestorCollectionForPath(
            event.document.fileName
        );
        if (
            collection &&
            tempJsFilesRegistry
                .getCollectionsWithRegisteredJsFiles()
                .map((registered) => normalizeDirectoryPath(registered))
                .includes(normalizeDirectoryPath(collection.getRootDirectory()))
        ) {
            deleteTemporaryJsFileForCollection(
                tempJsFilesRegistry,
                collection.getRootDirectory()
            );
        }

        if (
            window.activeTextEditor &&
            window.activeTextEditor.document.uri.toString() ==
                event.document.uri.toString()
        ) {
            const { blocks: parsedBlocks } = parseBruFile(
                new TextDocumentHelper(event.document.getText())
            );

            window.activeTextEditor.edit((editBuilder) => {
                updateUrlToMatchQueryParams(editBuilder, parsedBlocks);
                updatePathParamsKeysToMatchUrl(
                    event.document,
                    editBuilder,
                    parsedBlocks
                );
            });
        }
    }
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
