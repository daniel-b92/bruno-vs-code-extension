import {
    commands,
    ExtensionContext,
    TabInputText,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentWillSaveEvent,
    TextEditor,
    window,
    workspace,
    Event as VsCodeEvent,
    EventEmitter,
    Disposable,
} from "vscode";
import {
    getLoggerFromSubscriptions,
    TypedCollectionItemProvider,
    TypedCollection,
    FileSystemCacheSyncingHelper,
} from "@shared";
import {
    checkIfPathExistsAsync,
    filterAsync,
    CollectionWatcher,
    getTemporaryJsFileNameInFolder,
    getTemporaryJsFileBasename,
    TempJsFilesProvider,
    BrunoFileType,
    isBrunoFileType,
    getItemType,
    normalizePath,
    getFileExtensionForFormat,
    CollectionFormat,
    FeatureToggles,
} from "@global_shared";
import { provideTsLangCompletionItems } from "./internal/brunoFiles/completionItems/provideTsLangCompletionItems";
import { provideInfosOnHover as provideInfosOnHoverForBruFiles } from "./internal/brunoFiles/hover/provideInfosOnHover";
import { provideSignatureHelp as provideSignatureHelpForBruFiles } from "./internal/brunoFiles/signatureHelp/provideSignatureHelp";
import { provideDefinitions as provideDefinitionsForBruFiles } from "./internal/brunoFiles/definitionProvider/provideDefinitions";
import { extname } from "path";
import { TempJsFileUpdateQueue } from "./internal/shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { TempJsUpdateType } from "./internal/shared/temporaryJsFilesUpdates/internal/interfaces";
import { getTempJsFileContent } from "./internal/brunoFiles/shared/codeBlocksUtils/getTempJsFileContent";
import { getRequestFileDocumentSelector } from "./internal/brunoFiles/shared/getRequestFileDocumentSelector";
import { getDefinitionsForAllInbuiltLibraries } from "./internal/shared/temporaryJsFilesUpdates/internal/inbuiltLibraryDefinitions/getDefinitionsForAllInbuiltLibraries";
import { getCharacterForLineBreak } from "./internal/brunoFiles/shared/codeBlocksUtils/getCharacterForLineBreak";
import { configureTsServerPlugin } from "./configureTsServerPlugin";
import { registerLineCommentCommands } from "./internal/brunoFiles/lineComments/registerLineCommentCommands";

export async function activateLanguageFeatures(
    context: ExtensionContext,
    collectionWatcher: CollectionWatcher,
    collectionItemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    testRunStartedEvent: VsCodeEvent<unknown>,
    featureToggles: FeatureToggles,
) {
    const documentSelector = getRequestFileDocumentSelector(featureToggles);
    const logger = getLoggerFromSubscriptions(context);

    await configureTsServerPlugin(context, featureToggles, logger);

    const tempJsFilesUpdateQueue = new TempJsFileUpdateQueue(
        testRunStartedEvent,
        logger,
    );

    const tempJsFilesProvider = new TempJsFilesProvider(
        collectionWatcher,
        logger,
    );

    await tempJsFilesProvider.refreshCache(
        getUniqueParentFoldersForTempJsFiles(collectionItemProvider),
    );

    context.subscriptions.push(
        tempJsFilesUpdateQueue,
        tempJsFilesProvider,
        provideTsLangCompletionItems(
            documentSelector,
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideInfosOnHoverForBruFiles(
            documentSelector,
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideSignatureHelpForBruFiles(
            documentSelector,
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        provideDefinitionsForBruFiles(
            documentSelector,
            tempJsFilesUpdateQueue,
            collectionItemProvider,
            logger,
        ),
        tempJsFilesUpdateQueue,
        window.onDidChangeActiveTextEditor(async (editor) => {
            await onDidChangeActiveTextEditor(
                tempJsFilesUpdateQueue,
                collectionItemProvider,
                cacheSyncingHelper,
                tempJsFilesProvider,
                editor,
            );
        }),
        workspace.onDidChangeTextDocument(async (e) => {
            await onDidChangeTextDocument(
                collectionItemProvider,
                cacheSyncingHelper,
                e,
            );
        }),
        workspace.onWillSaveTextDocument(async (e) => {
            await onWillSaveTextDocument(
                tempJsFilesUpdateQueue,
                collectionItemProvider,
                tempJsFilesProvider,
                e,
            );
        }),
    );

    if (featureToggles.yamlCollectionSupport) {
        context.subscriptions.push(
            ...registerLineCommentCommands(collectionItemProvider),
        );
        // Used for enabling the keybindings of the line comment commands.
        await commands.executeCommand(
            "setContext",
            "bruAsCode.yamlCollectionSupport",
            true,
        );
    }
}

async function onDidChangeActiveTextEditor(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
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
        await deleteNonMandatoryTempJsFiles(
            queue,
            itemProvider,
            tempJsFilesProvider,
        );
    } else if (
        editor &&
        editor.document.uri.toString() ==
            window.tabGroups.activeTabGroup.activeTab.input.uri.toString()
    ) {
        const path = editor.document.fileName;

        const collection = getCollectionIfFileHasMatchingExtension(
            itemProvider,
            path,
        );

        if (collection) {
            handleOpeningOfCollectionFile(
                queue,
                itemProvider,
                cacheSyncingHelper,
                tempJsFilesProvider,
                collection,
                editor.document,
            );
        } else if (
            extname(path) == getFileExtensionForFormat(CollectionFormat.Bru)
        ) {
            window.showWarningMessage(
                "'bru' file seems to not be part of a valid collection. Therefore, intellisense will be limited.",
            );
            await deleteNonMandatoryTempJsFiles(
                queue,
                itemProvider,
                tempJsFilesProvider,
            );
        } else if (extname(path) == getExtensionForTempJsFiles()) {
            handleOpeningOfJsDocument(
                queue,
                itemProvider,
                tempJsFilesProvider,
                editor.document,
            );
        } else {
            await deleteNonMandatoryTempJsFiles(
                queue,
                itemProvider,
                tempJsFilesProvider,
            );
        }
    }
}

async function onDidChangeTextDocument(
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    { contentChanges, document: { fileName, uri } }: TextDocumentChangeEvent,
) {
    if (contentChanges.length > 0) {
        // If the document has been modified externally (not via VS Code), skip all actions
        if (
            window.activeTextEditor?.document.uri.toString() == uri.toString()
        ) {
            const collection =
                itemProvider.getAncestorCollectionForPath(fileName);

            if (!collection) {
                return;
            }

            const brunoFileType = await getBrunoFileTypeIfExists(
                itemProvider,
                fileName,
            );

            if (!brunoFileType) {
                return;
            }

            if (brunoFileType == BrunoFileType.RequestFile) {
                // Sometimes it can take a few seconds until the cache is up to date (e.g. when moving a file to a different folder).
                await cacheSyncingHelper.waitForFileToBeRegisteredInCache(
                    collection.getRootDirectory(),
                    fileName,
                );
            }
        }
    }
}

async function onWillSaveTextDocument(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    tempJsFilesProvider: TempJsFilesProvider,
    event: TextDocumentWillSaveEvent,
) {
    const { document } = event;

    if (
        getCollectionIfFileHasMatchingExtension(itemProvider, document.fileName)
    ) {
        await onWillSaveCollectionFile(
            queue,
            itemProvider,
            tempJsFilesProvider,
            document,
        );
    }
}

async function handleOpeningOfCollectionFile(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    tempJsFilesProvider: TempJsFilesProvider,
    collection: TypedCollection,
    { fileName, getText, eol }: TextDocument,
) {
    const toDispose: Disposable[] = [];
    let shouldAbort = false;
    const shouldAbortNotifier = new EventEmitter<void>();

    toDispose.push(
        workspace.onDidChangeTextDocument(
            ({ document: { fileName: changedFile } }) => {
                if (changedFile == fileName) {
                    shouldAbort = true;
                    shouldAbortNotifier.fire();
                }
            },
        ),
        shouldAbortNotifier,
    );

    try {
        const brunoFileType = await getBrunoFileTypeIfExists(
            itemProvider,
            fileName,
        );

        if (shouldAbort) {
            return;
        }

        if (!brunoFileType) {
            await deleteNonMandatoryTempJsFiles(
                queue,
                itemProvider,
                tempJsFilesProvider,
            );
            return;
        }

        if (brunoFileType == BrunoFileType.RequestFile) {
            // Sometimes it can take a few seconds until the cache is up to date (e.g. when moving a file to a different folder).
            await cacheSyncingHelper.waitForFileToBeRegisteredInCache(
                collection.getRootDirectory(),
                fileName,
                shouldAbortNotifier.event,
            );
        }

        if (shouldAbort) {
            return;
        }

        if (!getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType)) {
            await deleteNonMandatoryTempJsFiles(
                queue,
                itemProvider,
                tempJsFilesProvider,
            );
            return;
        }

        await queue.addToQueue({
            update: {
                type: TempJsUpdateType.Creation,
                filePath: getTemporaryJsFileNameInFolder(
                    collection.getRootDirectory(),
                ),
                tempJsFileContent: getTempJsFileContent(
                    getText(),
                    eol,
                    brunoFileType,
                    collection.getFormat(),
                ),
            },
        });
    } finally {
        for (const d of toDispose) {
            d.dispose();
        }
    }
}

async function handleOpeningOfJsDocument(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    tempJsFilesProvider: TempJsFilesProvider,
    document: TextDocument,
) {
    const path = document.fileName;
    const folderForTempJsFile = getFolderForTempJsFile(itemProvider, path);

    if (path.includes(getTemporaryJsFileBasename()) || !folderForTempJsFile) {
        await deleteNonMandatoryTempJsFiles(
            queue,
            itemProvider,
            tempJsFilesProvider,
        );
        return;
    }

    await queue.addToQueue({
        update: {
            type: TempJsUpdateType.Creation,
            filePath: getTemporaryJsFileNameInFolder(folderForTempJsFile),
            tempJsFileContent: getDefinitionsForAllInbuiltLibraries(
                document.eol,
                true,
            ).join(getCharacterForLineBreak(document.eol).repeat(2)),
        },
    });
}

async function onWillSaveCollectionFile(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    tempJsFilesProvider: TempJsFilesProvider,
    document: TextDocument,
) {
    const brunoFileType = await getBrunoFileTypeIfExists(
        itemProvider,
        document.fileName,
    );

    if (
        brunoFileType != undefined &&
        getBrunoFileTypesThatCanHaveCodeBlocks().includes(brunoFileType) &&
        itemProvider.getAncestorCollectionForPath(document.fileName)
    ) {
        deleteNonMandatoryTempJsFiles(queue, itemProvider, tempJsFilesProvider);
    }
}

async function deleteNonMandatoryTempJsFiles(
    updateQueue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    tempJsFilesProvider: TempJsFilesProvider,
) {
    const additionalContextRoots =
        itemProvider.getUniqueAdditionalContextRoots();

    const nonMandatoryTempJsFiles = tempJsFilesProvider
        .getRegisteredFiles()
        .filter(
            (file) =>
                itemProvider.getAncestorCollectionForPath(file) != undefined ||
                // Deleting temp JS files from additionalContextRoots folders should be avoided because the TS plugin currently only supresses
                // diagnostics for inbuilt runtime functions defined for JS files within collections.
                additionalContextRoots.every(
                    (root) =>
                        !normalizePath(file).startsWith(normalizePath(root)),
                ),
        );

    const existingFiles = await filterAsync(
        nonMandatoryTempJsFiles,
        async (filePath) => await checkIfPathExistsAsync(filePath),
    );

    if (existingFiles.length == 0) {
        return;
    }

    await updateQueue.addToQueue({
        update: {
            type: TempJsUpdateType.Deletion,
            filePaths: existingFiles,
        },
    });
}

function getCollectionIfFileHasMatchingExtension(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    return collection &&
        extname(filePath) == getFileExtensionForFormat(collection.getFormat())
        ? collection
        : undefined;
}

function getBrunoFileTypesThatCanHaveCodeBlocks() {
    return [
        BrunoFileType.CollectionSettingsFile,
        BrunoFileType.FolderSettingsFile,
        BrunoFileType.RequestFile,
    ];
}

async function getBrunoFileTypeIfExists(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection) {
        return undefined;
    }

    const itemType = await getItemType(collection, filePath);
    return itemType && isBrunoFileType(itemType) ? itemType : undefined;
}

function getFolderForTempJsFile(
    itemProvider: TypedCollectionItemProvider,
    jsFileName: string,
) {
    if (extname(jsFileName) != getExtensionForTempJsFiles()) {
        return undefined;
    }

    return (
        itemProvider
            .getAncestorCollectionForPath(jsFileName)
            ?.getRootDirectory() ??
        itemProvider.getAdditionalContextRootContainingItem(jsFileName)
            ?.matchingContextRoot
    );
}

function getUniqueParentFoldersForTempJsFiles(
    itemProvider: TypedCollectionItemProvider,
) {
    return itemProvider
        .getUniqueAdditionalContextRoots()
        .concat(
            itemProvider
                .getRegisteredCollections()
                .map((collection) => collection.getRootDirectory()),
        )
        .filter((path, index, array) => array.indexOf(path) === index);
}

function getExtensionForTempJsFiles() {
    return ".js";
}
