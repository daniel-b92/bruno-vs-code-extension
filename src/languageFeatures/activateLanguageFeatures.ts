import {
    DiagnosticCollection,
    ExtensionContext,
    languages,
    TabInputText,
    TextDocumentChangeEvent,
    TextDocumentWillSaveEvent,
    TextEditor,
    Uri,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    BrunoFileType,
    Collection,
    CollectionDirectory,
    CollectionFile,
    CollectionItemProvider,
    FileChangeType,
    getExtensionForRequestFiles,
    getLoggerFromSubscriptions,
    getTypeOfBrunoFile,
    normalizeDirectoryPath,
    OutputChannelLogger,
    parseBruFile,
    TextDocumentHelper,
} from "../shared";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";
import { createTemporaryJsFile } from "./internal/shared/codeBlocksUtils/createTemporaryJsFile";
import { TemporaryJsFilesRegistry } from "./internal/shared/temporaryJsFilesRegistry";
import { deleteTemporaryJsFileForCollection } from "./internal/shared/codeBlocksUtils/deleteTemporaryJsFile";
import { provideCodeBlocksCompletionItems } from "./internal/completionItems/provideCodeBlocksCompletionItems";
import { provideInfosOnHover } from "./internal/hover/provideInfosOnHover";
import { provideSignatureHelp } from "./internal/signatureHelp/provideSignatureHelp";
import { provideDefinitions } from "./internal/definitionProvider/provideDefinitions";
import { extname } from "path";
import { readFileSync } from "fs";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    const tempJsFilesRegistry = new TemporaryJsFilesRegistry();

    const diagnosticCollection =
        languages.createDiagnosticCollection("bru-as-code");

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );

    const logger = getLoggerFromSubscriptions(context);

    context.subscriptions.push(
        diagnosticCollection,
        tempJsFilesRegistry,
        ...provideBrunoLangCompletionItems(),
        provideCodeBlocksCompletionItems(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger
        ),
        provideInfosOnHover(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger
        ),
        provideSignatureHelp(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger
        ),
        provideDefinitions(collectionItemProvider, tempJsFilesRegistry, logger),
        brunoLangDiagnosticsProvider,
        tempJsFilesRegistry,
        window.onDidChangeActiveTextEditor((editor) => {
            onDidChangeActiveTextEditor(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                editor,
                logger
            );
        }),
        workspace.onDidChangeTextDocument((e) => {
            onDidChangeTextDocument(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                e,
                logger
            );
        }),
        workspace.onWillSaveTextDocument((e) => {
            onWillSaveTextDocument(
                tempJsFilesRegistry,
                collectionItemProvider,
                e
            );
        }),
        updateDiagnosticsOnDeletionOrExternalModification(
            collectionItemProvider,
            diagnosticCollection,
            brunoLangDiagnosticsProvider
        )
    );
}

function onDidChangeActiveTextEditor(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    editor: TextEditor | undefined,
    logger?: OutputChannelLogger
) {
    if (
        !editor ||
        !window.tabGroups.activeTabGroup.activeTab ||
        !(
            window.tabGroups.activeTabGroup.activeTab.input instanceof
            TabInputText
        )
    ) {
        deleteAllTemporaryJsFiles(tempJsFilesRegistry);
    } else if (
        editor.document.uri.toString() ==
        window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
    ) {
        const fileType = getTypeOfBrunoFile(
            collectionItemProvider.getRegisteredCollections().slice(),
            editor.document.uri.fsPath
        );

        if (fileType == undefined) {
            deleteAllTemporaryJsFiles(tempJsFilesRegistry);
            return;
        }

        fetchDiagnostics(
            editor.document.uri,
            editor.document.getText(),
            brunoLangDiagnosticsProvider,
            fileType
        );

        if (getBrunoFileTypesThatCanHaveCodeBlocks().includes(fileType)) {
            createTemporaryJsFile(
                (
                    collectionItemProvider.getAncestorCollectionForPath(
                        editor.document.fileName
                    ) as Collection
                ).getRootDirectory(),
                tempJsFilesRegistry,
                editor.document.getText(),
                logger
            );
        } else {
            deleteAllTemporaryJsFiles(tempJsFilesRegistry);
        }
    }
}

function onDidChangeTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentChangeEvent,
    logger?: OutputChannelLogger
) {
    if (event.contentChanges.length > 0) {
        // If the document has been modified externally (not via VS Code), skip all actions
        if (
            window.activeTextEditor?.document.uri.toString() ==
            event.document.uri.toString()
        ) {
            const fileType = getTypeOfBrunoFile(
                collectionItemProvider.getRegisteredCollections().slice(),
                event.document.uri.fsPath
            );

            if (fileType == undefined) {
                return;
            }

            fetchDiagnostics(
                event.document.uri,
                event.document.getText(),
                brunoLangDiagnosticsProvider,
                fileType
            );

            if (getBrunoFileTypesThatCanHaveCodeBlocks().includes(fileType)) {
                createTemporaryJsFile(
                    (
                        collectionItemProvider.getAncestorCollectionForPath(
                            event.document.fileName
                        ) as Collection
                    ).getRootDirectory(),
                    tempJsFilesRegistry,
                    event.document.getText(),
                    logger
                );
            }
        }
    }
}

function onWillSaveTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentWillSaveEvent
) {
    const fileType = getTypeOfBrunoFile(
        collectionItemProvider.getRegisteredCollections().slice(),
        event.document.uri.fsPath
    );

    if (
        fileType != undefined &&
        getBrunoFileTypesThatCanHaveCodeBlocks().includes(fileType)
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

function updateDiagnosticsOnDeletionOrExternalModification(
    collectionItemProvider: CollectionItemProvider,
    diagnosticCollection: DiagnosticCollection,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider
) {
    return collectionItemProvider.subscribeToUpdates()(
        ({ collection, data: { item }, updateType }) => {
            if (
                updateType == FileChangeType.Deleted &&
                item instanceof CollectionFile &&
                extname(item.getPath()) == getExtensionForRequestFiles()
            ) {
                diagnosticCollection.delete(Uri.file(item.getPath()));
            } else if (
                updateType == FileChangeType.Deleted &&
                item instanceof CollectionDirectory
            ) {
                const normalizedDirPath = normalizeDirectoryPath(
                    item.getPath()
                );

                diagnosticCollection.forEach((uri) => {
                    if (uri.fsPath.startsWith(normalizedDirPath)) {
                        diagnosticCollection.delete(uri);
                    }
                });
            } else if (
                updateType == FileChangeType.Modified &&
                item instanceof CollectionFile &&
                extname(item.getPath()) == getExtensionForRequestFiles() &&
                // If the modified file is the currently open one in VS Code, the diagnostics will already be updated on every change event.
                (!window.activeTextEditor ||
                    window.activeTextEditor.document.uri.fsPath !=
                        item.getPath()) &&
                // Only validate external modifications, if the file already has some diagnostics
                diagnosticCollection.get(Uri.file(item.getPath()))
            ) {
                fetchDiagnostics(
                    Uri.file(item.getPath()),
                    readFileSync(item.getPath()).toString(),
                    brunoLangDiagnosticsProvider,
                    getTypeOfBrunoFile(
                        [collection],
                        item.getPath()
                    ) as BrunoFileType
                );
            }
        }
    );
}

function fetchDiagnostics(
    uri: Uri,
    content: string,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    brunoFileType: BrunoFileType
) {
    if (brunoFileType == BrunoFileType.RequestFile) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForRequestFile(
            uri,
            content
        );
    } else if (brunoFileType == BrunoFileType.EnvironmentFile) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForEnvironmentFile(
            uri,
            content
        );
    } else if (brunoFileType == BrunoFileType.FolderSettingsFile) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForFolderSettingsFile(
            uri,
            content
        );
    }
}

function deleteAllTemporaryJsFiles(
    tempJsFilesRegistry: TemporaryJsFilesRegistry
) {
    for (const collection of tempJsFilesRegistry.getCollectionsWithRegisteredJsFiles()) {
        deleteTemporaryJsFileForCollection(tempJsFilesRegistry, collection);
    }
}

function getBrunoFileTypesThatCanHaveCodeBlocks() {
    return [
        BrunoFileType.CollectionSettingsFile,
        BrunoFileType.FolderSettingsFile,
        BrunoFileType.RequestFile,
    ];
}
