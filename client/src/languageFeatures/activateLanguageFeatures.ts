import {
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
    getExtensionForBrunoFiles,
    filterAsync,
    CollectionWatcher,
    getTemporaryJsFileNameInFolder,
    getTemporaryJsFileBasename,
    TempJsFilesProvider,
    BrunoFileType,
    isBrunoFileType,
    getItemType,
    normalizePath,
} from "@global_shared";
import { provideTsLangCompletionItems } from "./internal/brunoFiles/completionItems/provideTsLangCompletionItems";
import { provideInfosOnHover as provideInfosOnHoverForBruFiles } from "./internal/brunoFiles/hover/provideInfosOnHover";
import { provideSignatureHelp as provideSignatureHelpForBruFiles } from "./internal/brunoFiles/signatureHelp/provideSignatureHelp";
import { provideDefinitions as provideDefinitionsForBruFiles } from "./internal/brunoFiles/definitionProvider/provideDefinitions";
import { extname } from "path";
import { TempJsFileUpdateQueue } from "./internal/shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { TempJsUpdateType } from "./internal/shared/temporaryJsFilesUpdates/internal/interfaces";
import { getTempJsFileContentForBruFile } from "./internal/brunoFiles/shared/codeBlocksUtils/getTempJsFileContentForBruFile";
import { getDefinitionsForInbuiltLibraries } from "./internal/shared/temporaryJsFilesUpdates/external/getDefinitionsForInbuiltLibraries";
import { getCharacterForLineBreak } from "./internal/brunoFiles/shared/codeBlocksUtils/getCharacterForLineBreak";

export async function activateLanguageFeatures(
    context: ExtensionContext,
    collectionWatcher: CollectionWatcher,
    collectionItemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    testRunStartedEvent: VsCodeEvent<unknown>,
) {
    const logger = getLoggerFromSubscriptions(context);

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

        if (extname(path) == getExtensionForBrunoFiles()) {
            handleOpeningOfBruDocument(
                queue,
                itemProvider,
                cacheSyncingHelper,
                tempJsFilesProvider,
                editor.document,
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

    if (extname(document.fileName) == getExtensionForBrunoFiles()) {
        await onWillSaveBruDocument(
            queue,
            itemProvider,
            tempJsFilesProvider,
            document,
        );
    }
}

async function handleOpeningOfBruDocument(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    tempJsFilesProvider: TempJsFilesProvider,
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

    const collection = itemProvider.getAncestorCollectionForPath(fileName);
    if (!collection) {
        window.showWarningMessage(
            "'bru' file seems to not be part of a valid collection. Therefore, intellisense will be limited.",
        );
        await deleteNonMandatoryTempJsFiles(
            queue,
            itemProvider,
            tempJsFilesProvider,
        );
        return;
    }

    const brunoFileType = await getBrunoFileTypeIfExists(
        itemProvider,
        fileName,
    );

    if (shouldAbort) {
        for (const d of toDispose) {
            d.dispose();
        }
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
        for (const d of toDispose) {
            d.dispose();
        }
        return;
    }

    if (shouldAbort) {
        for (const d of toDispose) {
            d.dispose();
        }
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

    const collectionRootFolder = (
        itemProvider.getAncestorCollectionForPath(fileName) as TypedCollection
    ).getRootDirectory();

    await queue.addToQueue({
        update: {
            type: TempJsUpdateType.Creation,
            filePath: getTemporaryJsFileNameInFolder(collectionRootFolder),
            tempJsFileContent: getTempJsFileContentForBruFile(getText(), eol),
        },
    });

    for (const d of toDispose) {
        d.dispose();
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
            tempJsFileContent: getDefinitionsForInbuiltLibraries(
                document.eol,
                true,
            ).join(getCharacterForLineBreak(document.eol).repeat(2)),
        },
    });
}

async function onWillSaveBruDocument(
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
