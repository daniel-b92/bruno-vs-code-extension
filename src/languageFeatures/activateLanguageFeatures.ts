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
    getExtensionForBrunoFiles,
    getLoggerFromSubscriptions,
    normalizeDirectoryPath,
    OutputChannelLogger,
    parseBruFile,
    TextDocumentHelper,
    checkIfPathExistsAsync,
    isBrunoFileType,
} from "../shared";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";
import { createTemporaryJsFile } from "./internal/shared/temporaryJsFilesUpdates/internal/createTemporaryJsFile";
import { TemporaryJsFilesRegistry } from "./internal/shared/temporaryJsFilesUpdates/internal/temporaryJsFilesRegistry";
import { deleteTemporaryJsFileForCollection } from "./internal/shared/temporaryJsFilesUpdates/internal/deleteTemporaryJsFile";
import { provideCodeBlocksCompletionItems } from "./internal/completionItems/provideCodeBlocksCompletionItems";
import { provideInfosOnHover } from "./internal/hover/provideInfosOnHover";
import { provideSignatureHelp } from "./internal/signatureHelp/provideSignatureHelp";
import { provideDefinitions } from "./internal/definitionProvider/provideDefinitions";
import { extname } from "path";
import { registerCodeBlockFormatter } from "./internal/formatting/registerCodeBlockFormatter";
import { TempJsFileUpdateQueue } from "./internal/shared/temporaryJsFilesUpdates/tempJsFileUpdateQueue";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider,
) {
    const logger = getLoggerFromSubscriptions(context);

    const tempJsFilesRegistry = new TemporaryJsFilesRegistry();
    const tempJsFilesUpdateQueue = new TempJsFileUpdateQueue(
        tempJsFilesRegistry,
        logger,
    );

    const diagnosticCollection =
        languages.createDiagnosticCollection("bru-as-code");

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider,
    );

    context.subscriptions.push(
        diagnosticCollection,
        tempJsFilesUpdateQueue,
        ...provideBrunoLangCompletionItems(collectionItemProvider, logger),
        provideCodeBlocksCompletionItems(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger,
        ),
        provideInfosOnHover(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger,
        ),
        provideSignatureHelp(
            collectionItemProvider,
            tempJsFilesRegistry,
            logger,
        ),
        provideDefinitions(collectionItemProvider, tempJsFilesRegistry, logger),
        registerCodeBlockFormatter(logger),
        brunoLangDiagnosticsProvider,
        tempJsFilesUpdateQueue,
        window.onDidChangeActiveTextEditor(async (editor) => {
            await onDidChangeActiveTextEditor(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                editor,
                logger,
            );
        }),
        workspace.onDidChangeTextDocument(async (e) => {
            await onDidChangeTextDocument(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                e,
                logger,
            );
        }),
        workspace.onWillSaveTextDocument(async (e) => {
            await onWillSaveTextDocument(
                tempJsFilesRegistry,
                collectionItemProvider,
                e,
            );
        }),
        handleDiagnosticUpdatesOnFileDeletion(
            collectionItemProvider,
            diagnosticCollection,
        ),
    );
}

async function onDidChangeActiveTextEditor(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    editor: TextEditor | undefined,
    logger?: OutputChannelLogger,
) {
    if (
        !editor ||
        !window.tabGroups.activeTabGroup.activeTab ||
        !(
            window.tabGroups.activeTabGroup.activeTab.input instanceof
            TabInputText
        )
    ) {
        await deleteAllTemporaryJsFiles(tempJsFilesRegistry);
    } else if (
        editor.document.uri.toString() ==
        window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
    ) {
        const brunoFileType = await getBrunoFileTypeIfExists(
            collectionItemProvider,
            editor.document.uri.fsPath,
        );

        if (!brunoFileType) {
            await deleteAllTemporaryJsFiles(tempJsFilesRegistry);
            return;
        }

        await fetchBrunoSpecificDiagnostics(
            editor.document.uri,
            editor.document.getText(),
            brunoLangDiagnosticsProvider,
            brunoFileType,
        );

        if (getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType)) {
            await createTemporaryJsFile(
                (
                    collectionItemProvider.getAncestorCollectionForPath(
                        editor.document.fileName,
                    ) as Collection
                ).getRootDirectory(),
                tempJsFilesRegistry,
                editor.document.getText(),
                logger,
            );
        } else {
            await deleteAllTemporaryJsFiles(tempJsFilesRegistry);
        }
    }
}

async function onDidChangeTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentChangeEvent,
    logger?: OutputChannelLogger,
) {
    if (event.contentChanges.length > 0) {
        // If the document has been modified externally (not via VS Code), skip all actions
        if (
            window.activeTextEditor?.document.uri.toString() ==
            event.document.uri.toString()
        ) {
            const brunoFileType = await getBrunoFileTypeIfExists(
                collectionItemProvider,
                event.document.uri.fsPath,
            );

            if (!brunoFileType) {
                return;
            }

            await fetchBrunoSpecificDiagnostics(
                event.document.uri,
                event.document.getText(),
                brunoLangDiagnosticsProvider,
                brunoFileType,
            );

            if (
                getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType)
            ) {
                await createTemporaryJsFile(
                    (
                        collectionItemProvider.getAncestorCollectionForPath(
                            event.document.fileName,
                        ) as Collection
                    ).getRootDirectory(),
                    tempJsFilesRegistry,
                    event.document.getText(),
                    logger,
                );
            }
        }
    }
}

async function onWillSaveTextDocument(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentWillSaveEvent,
) {
    const brunoFileType = await getBrunoFileTypeIfExists(
        collectionItemProvider,
        event.document.fileName,
    );

    if (
        brunoFileType != undefined &&
        getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType)
    ) {
        const collection = collectionItemProvider.getAncestorCollectionForPath(
            event.document.fileName,
        );

        if (
            collection &&
            tempJsFilesRegistry
                .getCollectionsWithRegisteredJsFiles()
                .map((registered) => normalizeDirectoryPath(registered))
                .includes(normalizeDirectoryPath(collection.getRootDirectory()))
        ) {
            await deleteTemporaryJsFileForCollection(
                tempJsFilesRegistry,
                collection.getRootDirectory(),
            );
        }

        if (
            window.activeTextEditor &&
            window.activeTextEditor.document.uri.toString() ==
                event.document.uri.toString()
        ) {
            const { blocks: parsedBlocks } = parseBruFile(
                new TextDocumentHelper(event.document.getText()),
            );

            window.activeTextEditor.edit((editBuilder) => {
                updateUrlToMatchQueryParams(editBuilder, parsedBlocks);
                updatePathParamsKeysToMatchUrl(
                    event.document,
                    editBuilder,
                    parsedBlocks,
                );
            });
        }
    }
}

function handleDiagnosticUpdatesOnFileDeletion(
    collectionItemProvider: CollectionItemProvider,
    diagnosticCollection: DiagnosticCollection,
) {
    return collectionItemProvider.subscribeToUpdates()((updates) => {
        for (const {
            data: { item },
            updateType,
        } of updates) {
            if (
                updateType == FileChangeType.Deleted &&
                item instanceof CollectionFile &&
                extname(item.getPath()) == getExtensionForBrunoFiles()
            ) {
                diagnosticCollection.delete(Uri.file(item.getPath()));
            } else if (
                updateType == FileChangeType.Deleted &&
                item instanceof CollectionDirectory
            ) {
                const normalizedDirPath = normalizeDirectoryPath(
                    item.getPath(),
                );

                diagnosticCollection.forEach((uri) => {
                    if (uri.fsPath.startsWith(normalizedDirPath)) {
                        diagnosticCollection.delete(uri);
                    }
                });
            }
        }
    });
}

async function fetchBrunoSpecificDiagnostics(
    uri: Uri,
    content: string,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    brunoFileType: BrunoFileType,
) {
    if (brunoFileType == BrunoFileType.RequestFile) {
        await brunoLangDiagnosticsProvider.provideDiagnosticsForRequestFile(
            uri,
            content,
        );
    } else if (brunoFileType == BrunoFileType.EnvironmentFile) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForEnvironmentFile(
            uri,
            content,
        );
    } else if (brunoFileType == BrunoFileType.FolderSettingsFile) {
        await brunoLangDiagnosticsProvider.provideDiagnosticsForFolderSettingsFile(
            uri,
            content,
        );
    } else if (brunoFileType == BrunoFileType.CollectionSettingsFile) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForCollectionSettingsFile(
            uri,
            content,
        );
    } else {
        throw new Error(
            `Fetching Bruno specific diagnostics not implemented for file type '${brunoFileType}'.`,
        );
    }
}

async function deleteAllTemporaryJsFiles(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
) {
    const deletions: Promise<void>[] = [];

    for (const collection of tempJsFilesRegistry.getCollectionsWithRegisteredJsFiles()) {
        deletions.push(
            deleteTemporaryJsFileForCollection(tempJsFilesRegistry, collection),
        );
    }

    await Promise.all(deletions);
}

function getBrunoFileTypesThatCanHaveCodeBlocks() {
    return [
        BrunoFileType.CollectionSettingsFile,
        BrunoFileType.FolderSettingsFile,
        BrunoFileType.RequestFile,
    ];
}

async function getBrunoFileTypeIfExists(
    collectionItemProvider: CollectionItemProvider,
    filePath: string,
) {
    const itemWithCollection =
        collectionItemProvider.getRegisteredItemAndCollection(filePath);

    return itemWithCollection &&
        (await checkIfPathExistsAsync(filePath)) &&
        itemWithCollection.data.item instanceof CollectionFile &&
        isBrunoFileType(itemWithCollection.data.item.getFileType())
        ? (itemWithCollection.data.item.getFileType() as BrunoFileType)
        : undefined;
}
