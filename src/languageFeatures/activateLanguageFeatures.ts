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
    castBlockToDictionaryBlock,
    checkIfPathExistsAsync,
    Collection,
    CollectionDirectory,
    CollectionFile,
    CollectionItemProvider,
    EnvironmentFileBlockName,
    FileChangeType,
    getExtensionForBrunoFiles,
    getLoggerFromSubscriptions,
    normalizeDirectoryPath,
    OutputChannelLogger,
    parseBruFile,
    TextDocumentHelper,
    isBrunoFileType,
    getConfiguredTestEnvironment,
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
import { extname, resolve } from "path";
import { registerCodeBlockFormatter } from "./internal/formatting/registerCodeBlockFormatter";
import { readFile } from "fs";
import { promisify } from "util";

export function activateLanguageFeatures(
    context: ExtensionContext,
    itemProvider: CollectionItemProvider,
) {
    const tempJsFilesRegistry = new TemporaryJsFilesRegistry();

    const diagnosticCollection =
        languages.createDiagnosticCollection("bru-as-code");

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        itemProvider,
    );

    const logger = getLoggerFromSubscriptions(context);

    context.subscriptions.push(
        diagnosticCollection,
        tempJsFilesRegistry,
        ...provideBrunoLangCompletionItems(itemProvider, logger),
        provideCodeBlocksCompletionItems(
            itemProvider,
            tempJsFilesRegistry,
            logger,
        ),
        provideInfosOnHover(itemProvider, tempJsFilesRegistry, logger),
        provideSignatureHelp(itemProvider, tempJsFilesRegistry, logger),
        provideDefinitions(itemProvider, tempJsFilesRegistry, logger),
        registerCodeBlockFormatter(logger),
        brunoLangDiagnosticsProvider,
        tempJsFilesRegistry,
        window.onDidChangeActiveTextEditor(async (editor) => {
            await onDidChangeActiveTextEditor(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                itemProvider,
                editor,
                logger,
            );
        }),
        workspace.onDidChangeTextDocument(async (e) => {
            await onDidChangeTextDocument(
                tempJsFilesRegistry,
                brunoLangDiagnosticsProvider,
                itemProvider,
                e,
                logger,
            );
        }),
        workspace.onWillSaveTextDocument(async (e) => {
            await onWillSaveTextDocument(tempJsFilesRegistry, itemProvider, e);
        }),
        handleDiagnosticUpdatesOnFileDeletion(
            itemProvider,
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

async function fetchAvailableVarsFromConfiguredEnvironments(
    itemProvider: CollectionItemProvider,
) {
    const environmentName = getConfiguredTestEnvironment();

    if (!environmentName) {
        return undefined;
    }

    const collections = itemProvider.getRegisteredCollections().slice();

    // for each collection the environment is used with the configured name
    const environmentFiles = (
        await Promise.all(
            collections.map(async (collection) => {
                const environmentFile = resolve(
                    collection.getRootDirectory(),
                    "environments",
                    `${environmentName}${getExtensionForBrunoFiles()}`,
                ); // ToDo: Save type of file already in cache

                return (await checkIfPathExistsAsync(environmentFile))
                    ? { collection, environmentFile }
                    : undefined;
            }),
        )
    ).filter((val) => val != undefined);

    return (
        await Promise.all(
            environmentFiles.map(async ({ collection, environmentFile }) => {
                const varsBlocks = parseBruFile(
                    new TextDocumentHelper(
                        await promisify(readFile)(environmentFile, {
                            encoding: "utf-8",
                        }),
                    ),
                ).blocks.filter(
                    ({ name }) => name == EnvironmentFileBlockName.Vars,
                );

                if (varsBlocks.length != 1) {
                    return undefined;
                }

                const castedBlock = castBlockToDictionaryBlock(varsBlocks[0]);

                if (!castedBlock) {
                    return undefined;
                }

                return {
                    collection,
                    envVars: castedBlock.content.map(({ key }) => key),
                };
            }),
        )
    ).filter((val) => val != undefined);
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
