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
import { provideBrunoLangCompletionItems } from "./internal/brunoFiles/completionItems/provideBrunoLangCompletionItems";
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
    parseBruFile,
    TextDocumentHelper,
    checkIfPathExistsAsync,
    isBrunoFileType,
    getTemporaryJsFileNameInFolder,
    filterAsync,
    CollectionWatcher,
} from "../shared";
import { BrunoLangDiagnosticsProvider } from "./internal/brunoFiles/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/brunoFiles/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/brunoFiles/autoUpdates/updatePathParamsKeysToMatchUrl";
import { provideCodeBlocksCompletionItems } from "./internal/brunoFiles/completionItems/provideCodeBlocksCompletionItems";
import { provideInfosOnHover as provideInfosOnHoverForBruFiles } from "./internal/brunoFiles/hover/provideInfosOnHover";
import { provideSignatureHelp as provideSignatureHelpForBruFiles } from "./internal/brunoFiles/signatureHelp/provideSignatureHelp";
import { provideDefinitions as provideDefinitionsForBruFiles } from "./internal/brunoFiles/definitionProvider/provideDefinitions";
import { extname } from "path";
import { registerCodeBlockFormatter } from "./internal/brunoFiles/formatting/registerCodeBlockFormatter";
import { TempJsFileUpdateQueue } from "./internal/shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { TempJsUpdateType } from "./internal/shared/temporaryJsFilesUpdates/internal/interfaces";
import { getTempJsFileContentForBruFile } from "./internal/brunoFiles/shared/codeBlocksUtils/getTempJsFileContentForBruFile";
import { registerHoverProvider as registerHoverProviderForJsFiles } from "./internal/jsFiles/hover/registerHoverProvider";
import { registerCompletionItemProvider as registerCompletionItemProviderForJsFiles } from "./internal/jsFiles/completionItems/registerCompletionItemProvider";
import { registerSignatureHelpProvider as registerSignatureHelpProviderForJsFiles } from "./internal/jsFiles/signatureHelp/registerSignatureHelpProvider";
import { TempJsFilesProvider } from "../shared/fileSystemCache/externalHelpers/tempJsFilesProvider";

export async function activateLanguageFeatures(
    context: ExtensionContext,
    collectionWatcher: CollectionWatcher,
    collectionItemProvider: CollectionItemProvider,
) {
    const logger = getLoggerFromSubscriptions(context);

    const tempJsFilesUpdateQueue = new TempJsFileUpdateQueue(logger);

    const tempJsFilesProvider = new TempJsFilesProvider(
        collectionWatcher,
        logger,
    );

    await tempJsFilesProvider.refreshCache(
        collectionItemProvider
            .getRegisteredCollections()
            .map((collection) => collection.getRootDirectory()),
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
        tempJsFilesProvider,
        ...provideBrunoLangCompletionItems(collectionItemProvider, logger),
        provideCodeBlocksCompletionItems(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideInfosOnHoverForBruFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideSignatureHelpForBruFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideDefinitionsForBruFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        registerCodeBlockFormatter(logger),
        registerHoverProviderForJsFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        registerCompletionItemProviderForJsFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        registerSignatureHelpProviderForJsFiles(
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        brunoLangDiagnosticsProvider,
        tempJsFilesUpdateQueue,
        window.onDidChangeActiveTextEditor(async (editor) => {
            await onDidChangeActiveTextEditor(
                tempJsFilesUpdateQueue,
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                tempJsFilesProvider,
                editor,
            );
        }),
        workspace.onDidChangeTextDocument(async (e) => {
            await onDidChangeTextDocument(
                brunoLangDiagnosticsProvider,
                collectionItemProvider,
                e,
            );
        }),
        workspace.onWillSaveTextDocument(async (e) => {
            await onWillSaveTextDocument(
                tempJsFilesUpdateQueue,
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
    queue: TempJsFileUpdateQueue,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    itemProvider: CollectionItemProvider,
    tempJsFilesProvider: TempJsFilesProvider,
    editor: TextEditor | undefined,
) {
    if (
        !window.tabGroups.activeTabGroup.activeTab ||
        !(
            window.tabGroups.activeTabGroup.activeTab.input instanceof
            TabInputText
        )
    ) {
        await deleteAllTemporaryJsFiles(queue, tempJsFilesProvider);
    } else if (
        editor &&
        editor.document.uri.toString() ==
            window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
    ) {
        const brunoFileType = await getBrunoFileTypeIfExists(
            itemProvider,
            editor.document.uri.fsPath,
        );

        if (!brunoFileType) {
            await deleteAllTemporaryJsFiles(queue, tempJsFilesProvider);
            return;
        }

        await fetchBrunoSpecificDiagnostics(
            editor.document.uri,
            editor.document.getText(),
            brunoLangDiagnosticsProvider,
            brunoFileType,
        );

        if (getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType)) {
            const collectionRootFolder = (
                itemProvider.getAncestorCollectionForPath(
                    editor.document.fileName,
                ) as Collection
            ).getRootDirectory();

            await queue.addToQueue({
                filePath: getTemporaryJsFileNameInFolder(collectionRootFolder),
                update: {
                    type: TempJsUpdateType.Creation,
                    tempJsFileContent: getTempJsFileContentForBruFile(
                        editor.document.getText(),
                    ),
                },
            });
        } else {
            await deleteAllTemporaryJsFiles(queue, tempJsFilesProvider);
        }
    }
}

async function onDidChangeTextDocument(
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    collectionItemProvider: CollectionItemProvider,
    event: TextDocumentChangeEvent,
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
        }
    }
}

async function onWillSaveTextDocument(
    queue: TempJsFileUpdateQueue,
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

        if (collection) {
            queue.addToQueue({
                filePath: getTemporaryJsFileNameInFolder(
                    collection.getRootDirectory(),
                ),
                update: { type: TempJsUpdateType.Deletion },
            });
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
    updateQueue: TempJsFileUpdateQueue,
    tempJsFilesProvider: TempJsFilesProvider,
) {
    const deletions: Promise<boolean>[] = [];

    const existingFiles = await filterAsync(
        tempJsFilesProvider.getRegisteredFiles(),
        async (filePath) => await checkIfPathExistsAsync(filePath),
    );

    for (const filePath of existingFiles) {
        deletions.push(
            updateQueue.addToQueue({
                filePath,
                update: { type: TempJsUpdateType.Deletion },
            }),
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
