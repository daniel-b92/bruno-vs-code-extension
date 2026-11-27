import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    getFileExtensionForFormat,
    getFolderSettingsFilePath,
    checkIfPathExistsAsync,
    normalizePath,
    BrunoFileType,
    getConfiguredEnvironmentName,
    CollectionItem,
    CollectionItemWithSequence,
    isCollectionItemWithSequence,
    CollectionFormat,
    getBrunoJsonFilePath,
    NonBrunoFile,
    canSequenceBeUsedAsPrefix,
    getSequencePrefix,
    renameItemToMatchSequenceCommand,
    isReservedPath,
} from "@global_shared";
import {
    TypedCollectionItemProvider,
    OutputChannelLogger,
    DialogOptionLabelEnum,
    TypedCollectionData,
    TypedCollection,
    FileSystemCacheSyncingHelper,
    removeConfigForCollection,
    BrunoTreeItem,
    shouldPrefixNamesWithSequence,
} from "@shared";
import { basename, dirname, extname, resolve } from "path";
import { validateNewItemNameIsUnique } from "./explorer/validateNewItemNameIsUnique";
import {
    getMessageForNameUsedBySibling,
    validateNameHasNoPathSeparator,
    validateNameIsNotUsedBySibling,
} from "./explorer/validateEnteredName";
import {
    removeEnteredSequencePrefix,
    validateNewNameForRenaming,
} from "./explorer/validateNewNameForRenaming";
import { createRequestFile } from "./explorer/fileUtils/createRequestFile";
import { replaceItemName } from "./explorer/fileUtils/replaceItemName";
import { replaceNameInBrunoJson } from "./explorer/fileUtils/replaceNameInBrunoJson";
import { getPathForDuplicatedItem } from "./explorer/getPathForDuplicatedItem";
import { renameFileOrFolder } from "./explorer/renameFileOrFolder";
import { normalizeSequencesRecursively } from "./explorer/normalizeSequencesRecursively";
import { selectSequenceStep } from "./explorer/selectSequenceStep";
import { updateSettingsFileOfDuplicatedFolder } from "./explorer/folderUtils/updateSettingsFileOfDuplicatedFolder";
import { moveFolderIntoTargetFolder } from "./explorer/folderUtils/moveFolderIntoTargetFolder";
import { FolderDropInsertionOption } from "./explorer/folderDropInsertionOptionEnum";
import { moveFileIntoFolder } from "./explorer/fileUtils/moveFileIntoFolder";
import { promisify } from "util";
import { cp, mkdir, readFile, rm, writeFile } from "fs";
import { stat } from "fs/promises";
import { closeTabsRelatedToItem } from "./explorer/closeTabsRelatedToItem";
import { showDialogForSettingEnvironment } from "./explorer/showDialogForSettingEnvironment";
import { getDeleteConfirmationMessage } from "./explorer/getDeleteConfirmationMessage";
import { insertFileAndSyncSequencePrefixes } from "./explorer/fileUtils/insertFileAndSyncSequencePrefixes";
import {
    FileInsertionPosition,
    RequestFileInsertionPositionType,
} from "./explorer/fileUtils/interfaces";
import { ContextRootItemProvider } from "./contextRoots/contextRootItemProvider";
import { getTargetPathForMovingItem } from "./explorer/contextRootUtils/getTargetPathForMovingItem";
import { duplicateItemOutsideCollections } from "./explorer/contextRootUtils/duplicateItemOutsideCollections";
import { pasteFileOutsideCollections } from "./explorer/contextRootUtils/pasteFileOutsideCollections";
import { deleteItemOutsideCollections } from "./explorer/contextRootUtils/deleteItemOutsideCollections";
import { showErrorMessageForFailedDragAndDrop } from "./explorer/showErrorMessageForFailedDragAndDrop";
import { syncSequencePrefixes } from "./explorer/sequencePrefixUtils/syncSequencePrefixes";
import { getNameWithoutSequencePrefix } from "./explorer/sequencePrefixUtils/getNameWithoutSequencePrefix";
import { canNameHaveSequencePrefix } from "./explorer/sequencePrefixUtils/canNameHaveSequencePrefix";
import {
    addSequenceOfCopiedItem,
    getSequencesBeforeChange,
} from "./explorer/sequencePrefixUtils/getSequencesBeforeChange";
import { getCheckForNamesOfDuplicatedItem } from "./explorer/sequencePrefixUtils/getCheckForNamesOfDuplicatedItem";
import { getFolderWithItemsAffectedByFile } from "./explorer/sequencePrefixUtils/getFolderWithItemsAffectedByFile";
import { getNameUsedBySiblingOfInsertedItem } from "./explorer/sequencePrefixUtils/getNameUsedBySiblingOfInsertedItem";
import { getSiblingNamesWithoutSequencePrefix } from "./explorer/sequencePrefixUtils/getSiblingNamesWithoutSequencePrefix";
import { updateSequencesAfterDeletingItem } from "./explorer/updateSequencesAfterDeletingItem";
import { removeSequencePrefixesRecursively } from "./explorer/sequencePrefixUtils/removeSequencePrefixesRecursively";

export class CollectionExplorer implements vscode.TreeDragAndDropController<BrunoTreeItem> {
    private treeViewId = "brunoCollectionsView";
    dragMimeTypes = ["text/uri-list"];
    dropMimeTypes = [`application/vnd.code.tree.${this.treeViewId}`];

    constructor(
        private itemProvider: TypedCollectionItemProvider,
        private cacheSyncingHelper: FileSystemCacheSyncingHelper,
        startTestRunEmitter: vscode.EventEmitter<{
            uri: vscode.Uri;
            withDialog: boolean;
        }>,
        private logger?: OutputChannelLogger,
    ) {
        if (
            !vscode.workspace.workspaceFolders ||
            vscode.workspace.workspaceFolders.length == 0
        ) {
            throw new Error(
                "Activation of collection explorer failed because no workspace folders were found!",
            );
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        this.contextRootProvider = new ContextRootItemProvider(
            itemProvider,
            workspaceRoot,
            logger,
        );
        this.disposables.push(this.contextRootProvider);

        const treeDataProvider = new BrunoTreeItemProvider(
            workspaceRoot,
            itemProvider,
            this.contextRootProvider,
            logger,
        );

        const treeView = vscode.window.createTreeView(this.treeViewId, {
            treeDataProvider,
            dragAndDropController: this,
            showCollapseAll: true,
        });

        this.registerCommands(treeDataProvider, startTestRunEmitter);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(async (e) => {
                if (treeView.visible && e) {
                    await this.tryToRevealItem(
                        e.document.fileName,
                        treeView,
                        logger,
                    );
                }
            }),
            treeView.onDidChangeVisibility(async (e) => {
                if (e.visible && vscode.window.activeTextEditor) {
                    await this.tryToRevealItem(
                        vscode.window.activeTextEditor.document.fileName,
                        treeView,
                        logger,
                    );
                }
            }),
            vscode.window.onDidChangeTextEditorSelection(async (e) => {
                if (
                    treeView.visible &&
                    treeView.selection.every(
                        (treeItem) =>
                            treeItem.getPath() !=
                            e.textEditor.document.fileName,
                    )
                )
                    await this.tryToRevealItem(
                        e.textEditor.document.fileName,
                        treeView,
                        logger,
                    );
            }),
        );
    }

    private disposables: vscode.Disposable[] = [];
    private contextRootProvider: ContextRootItemProvider;
    private fileToCopy:
        | { item: CollectionItem | CollectionItemWithSequence; content: string }
        | undefined = undefined;
    private confirmationOptionForModals = DialogOptionLabelEnum.Confirm;

    public dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    handleDrag(
        source: readonly BrunoTreeItem[],
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken,
    ) {
        dataTransfer.set("text/uri-list", {
            asString() {
                return Promise.resolve(source[0].getPath());
            },
            asFile() {
                return undefined;
            },
            value: source[0],
        });
    }

    async handleDrop(
        maybeTarget: BrunoTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken,
    ) {
        const transferItem = dataTransfer.get("text/uri-list");

        if (transferItem && maybeTarget) {
            const sourcePath = await transferItem.asString();

            if (
                this.isOutsideCollections(sourcePath) ||
                this.isOutsideCollections(maybeTarget.getPath())
            ) {
                await this.moveItemWithoutCollectionLogic(
                    sourcePath,
                    maybeTarget,
                );
                return;
            }
        }

        const gatheredData = await this.gatherDataForDroppingItem(
            maybeTarget,
            dataTransfer,
        );

        if (!gatheredData) {
            return;
        }

        const {
            originalItemData: {
                item: originalItem,
                additionalData: { treeItem: originalTreeItem },
            },
            sourcePath,
            targetCollection,
            target,
        } = gatheredData;

        if (originalTreeItem.isFile) {
            const newPath = resolve(
                target.isFile ? dirname(target.getPath()) : target.getPath(),
                basename(sourcePath),
            );

            if (
                await this.rejectInsertionIfNameIsUsedBySibling(
                    targetCollection,
                    originalItem,
                    dirname(newPath),
                    newPath,
                )
            ) {
                return;
            }

            const { proceed, overwrite } =
                await this.requestConfirmationForOverwritingItemIfNeeded(
                    sourcePath,
                    newPath,
                    targetCollection,
                );

            if (!proceed) {
                return;
            }

            const itemType = originalItem.getItemType();

            if (originalItem.isFile()) {
                await this.withProgressInExplorer(
                    `Moving '${basename(sourcePath)}'`,
                    () =>
                        moveFileIntoFolder(
                            this.itemProvider,
                            sourcePath,
                            newPath,
                            target,
                            dirname(newPath),
                            itemType,
                            this.logger,
                            overwrite,
                        ),
                );

                return;
            }
        }

        if (target.isFile) {
            vscode.window.showInformationMessage(
                "Cannot use a file as a target for moving a folder to. Please select a folder instead.",
            );
            return;
        }
        if (target.getPath().includes(sourcePath)) {
            vscode.window.showInformationMessage(
                "Cannot use a descendant item as a target for moving a folder to. Please select a different target folder.",
            );
            return;
        }

        if (!target.getSequence()) {
            // If the target does not have a sequence, moving a folder should always cause an insertion into the target folder.
            const newPath = resolve(target.getPath(), basename(sourcePath));

            if (
                await this.rejectInsertionIfNameIsUsedBySibling(
                    targetCollection,
                    originalItem,
                    target.getPath(),
                    newPath,
                )
            ) {
                return;
            }

            const { proceed, overwrite } =
                await this.requestConfirmationForOverwritingItemIfNeeded(
                    sourcePath,
                    newPath,
                    targetCollection,
                );

            if (!proceed) {
                return;
            }

            await this.withProgressInExplorer(
                `Moving '${basename(sourcePath)}'`,
                () =>
                    moveFolderIntoTargetFolder(
                        this.itemProvider,
                        sourcePath,
                        target,
                        FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
                        originalTreeItem.getSequence(),
                        this.logger,
                        overwrite,
                    ),
            );
            return;
        }

        const pickedOption = await vscode.window.showInformationMessage(
            `Where should the folder '${basename(sourcePath)}' be inserted?`,
            { modal: true },
            ...Object.values(FolderDropInsertionOption),
        );

        if (!pickedOption) {
            return;
        }

        // Overwriting is only offered for moving into the target folder.
        const isMovedIntoTarget =
            pickedOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder;
        const targetFolder = isMovedIntoTarget
            ? target.getPath()
            : dirname(target.getPath());
        const newPath = resolve(targetFolder, basename(sourcePath));

        if (
            await this.rejectInsertionIfNameIsUsedBySibling(
                targetCollection,
                originalItem,
                targetFolder,
                isMovedIntoTarget ? newPath : sourcePath,
            )
        ) {
            return;
        }

        const { proceed, overwrite } = isMovedIntoTarget
            ? await this.requestConfirmationForOverwritingItemIfNeeded(
                  sourcePath,
                  newPath,
                  targetCollection,
              )
            : {
                  proceed: !(await this.rejectInsertionIfPathIsTaken(
                      sourcePath,
                      newPath,
                  )),
                  overwrite: false,
              };

        if (!proceed) {
            return;
        }

        await this.withProgressInExplorer(
            `Moving '${basename(sourcePath)}'`,
            () =>
                moveFolderIntoTargetFolder(
                    this.itemProvider,
                    sourcePath,
                    target,
                    pickedOption,
                    originalTreeItem.getSequence(),
                    this.logger,
                    overwrite,
                ),
        );
    }

    /**
     * Whether the item is located in an additional context root (and not in a collection).
     * Only the path is checked, since e.g. drag and drop and pasting only provide paths.
     */
    private isOutsideCollections(path: string) {
        return (
            !this.itemProvider.getAncestorCollectionForPath(path) &&
            this.contextRootProvider.findContextRootForPath(path) !== undefined
        );
    }

    /** Overwriting a sibling whose name only differs in the sequence prefix is not offered, since it has another sequence. */
    private async rejectInsertionIfNameIsUsedBySibling(
        targetCollection: TypedCollection | undefined,
        sourceItem: CollectionItem,
        targetFolder: string,
        /** See `getNameUsedBySiblingOfInsertedItem`. */
        replacedPath: string,
    ) {
        const usedName =
            targetCollection &&
            (await getNameUsedBySiblingOfInsertedItem(
                targetCollection,
                sourceItem,
                targetFolder,
                replacedPath,
            ));

        if (usedName === undefined) {
            return false;
        }

        vscode.window.showErrorMessage(
            `${getMessageForNameUsedBySibling(usedName)} in '${basename(targetFolder)}'.`,
        );
        return true;
    }

    private async rejectInsertionIfPathIsTaken(
        sourcePath: string,
        newPath: string,
    ) {
        const message = await validateNewItemNameIsUnique(newPath, sourcePath);

        if (message === undefined) {
            return false;
        }

        vscode.window.showErrorMessage(
            `${message} in '${basename(dirname(newPath))}'.`,
        );
        return true;
    }

    private rejectActionForContextRootFolder(path: string, action: string) {
        if (!this.contextRootProvider.isTopLevelContextRoot(path)) {
            return false;
        }

        vscode.window.showInformationMessage(
            `The folder of an additional context root cannot be ${action} in the collection explorer.`,
        );
        return true;
    }

    /**
     * Moves an item via drag and drop if the source or the target is located outside of collections.
     * Neither sequences nor `bru.runRequest` paths are adjusted for these moves, and folders are always moved into the target folder.
     */
    private async moveItemWithoutCollectionLogic(
        sourcePath: string,
        target: BrunoTreeItem,
    ) {
        if (
            this.rejectActionForContextRootFolder(sourcePath, "moved") ||
            !(await checkIfPathExistsAsync(target.getPath()))
        ) {
            return;
        }

        const targetPathData = await getTargetPathForMovingItem(sourcePath, {
            path: target.getPath(),
            isFile: target.isFile,
        });

        if (targetPathData.kind == "rejected") {
            vscode.window.showInformationMessage(targetPathData.message);
            return;
        }
        if (targetPathData.kind == "unchanged") {
            return;
        }

        const { newPath, isFile } = targetPathData;
        const sourceCollection =
            this.itemProvider.getAncestorCollectionForPath(sourcePath);

        if (sourceCollection?.isRootDirectory(sourcePath)) {
            vscode.window.showInformationMessage(
                "Cannot move the root folder of a collection via the collection explorer.",
            );
            return;
        }
        const targetCollection =
            this.itemProvider.getAncestorCollectionForPath(newPath);

        const { proceed, overwrite } =
            await this.requestConfirmationForOverwritingItemIfNeeded(
                sourcePath,
                newPath,
                targetCollection,
            );

        if (!proceed) {
            return;
        }

        await this.withProgressInExplorer(
            `Moving '${basename(sourcePath)}'`,
            async () => {
                const wasSuccessful = await renameFileOrFolder(
                    this.itemProvider,
                    sourcePath,
                    newPath,
                    isFile,
                    this.logger,
                    overwrite,
                );

                if (!wasSuccessful) {
                    showErrorMessageForFailedDragAndDrop(sourcePath);
                }
            },
        );
    }

    /** Shows the progress bar of the collection explorer while the task is running. */
    private withProgressInExplorer<T>(title: string, task: () => Promise<T>) {
        return vscode.window.withProgress(
            { location: { viewId: this.treeViewId }, title },
            task,
        );
    }

    private async gatherDataForDroppingItem(
        target: BrunoTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
    ) {
        const transferItem = dataTransfer.get("text/uri-list");

        if (
            !transferItem ||
            !target ||
            !(await checkIfPathExistsAsync(target.getPath()))
        ) {
            return undefined;
        }

        const sourcePath = await transferItem.asString();
        const sourceCollection =
            this.itemProvider.getAncestorCollectionForPath(sourcePath);

        if (
            !sourceCollection ||
            !sourceCollection.getStoredDataForPath(sourcePath)
        ) {
            vscode.window.showErrorMessage(
                `An unexpected error occured. Could not determine collection for path '${sourcePath}'.`,
            );
            return undefined;
        }

        const originalItemData = sourceCollection.getStoredDataForPath(
            sourcePath,
        ) as TypedCollectionData;

        const targetCollection = this.itemProvider.getAncestorCollectionForPath(
            target.getPath(),
        );

        // TODO: Support drag-and-drop between collections with different formats (Bru <-> Yaml).
        // This would require converting the file content and adjusting the file extension.
        if (
            targetCollection &&
            targetCollection.getFormat() != sourceCollection.getFormat()
        ) {
            vscode.window.showErrorMessage(
                `Moving items between collections with different formats (Bru and Yaml) is not supported.`,
            );
            return undefined;
        }

        return {
            originalItemData,
            sourcePath: originalItemData.item.getPath(),
            targetCollection,
            target,
        };
    }

    private registerCommands(
        treeDataProvider: BrunoTreeItemProvider,
        startTestRunEmitter: vscode.EventEmitter<{
            uri: vscode.Uri;
            withDialog: boolean;
        }>,
    ) {
        this.disposables.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.refresh`,
                () => {
                    vscode.window.withProgress(
                        { location: { viewId: this.treeViewId } },
                        () => {
                            return treeDataProvider.refresh();
                        },
                    );
                },
            ),
        );

        this.disposables.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.openInNewTabgroup`,
                (item: BrunoTreeItem) => {
                    this.openFile(item.getPath(), vscode.ViewColumn.Beside);
                },
            ),
        );

        this.disposables.push(
            ...this.registerCommandsForCreatingItems(),
            this.registerCommandForRenamingItem(),
            this.registerCommandForDuplicatingFile(),
            this.registerCommandForDuplicatingFolder(),
            this.registerCommandForDeletingItem(),
            ...this.registerCommandsForStartingTestrun(startTestRunEmitter),
            this.registerCommandForEnvironmentSelection(),
            this.registerCommandForNormalizingSequences(),
            this.registerCommandForRemovingSequencePrefixes(),
            this.registerCommandForRenamingToMatchSequence(),
            ...this.registerCommandsForCopyingAndPastingFiles(),
        );
    }

    private registerCommandsForCreatingItems() {
        const result: vscode.Disposable[] = [];

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.createRequestFile`,
                (item: BrunoTreeItem) => {
                    createRequestFile(
                        this.itemProvider,
                        this.cacheSyncingHelper,
                        item,
                    );
                },
            ),
        );

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.createEmptyFile`,
                async (item: BrunoTreeItem) => {
                    const parentFolderPath = item.getPath();
                    const siblingNamesWithoutPrefix =
                        await this.getSiblingNamesForValidatingNewName(
                            parentFolderPath,
                            { isFile: true },
                        );

                    const fileName = await vscode.window.showInputBox({
                        title: `Create file in '${basename(parentFolderPath)}'`,
                        validateInput: async (newFileName: string) =>
                            validateNameHasNoPathSeparator(newFileName) ??
                            (await validateNewItemNameIsUnique(
                                resolve(parentFolderPath, newFileName),
                            )) ??
                            validateNameIsNotUsedBySibling(
                                newFileName,
                                siblingNamesWithoutPrefix,
                            ),
                    });

                    if (fileName == undefined) {
                        return;
                    }

                    const filePath = resolve(parentFolderPath, fileName);
                    await this.writeFileAndOpenItOnSuccess(filePath, "");
                },
            ),
        );

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.createFolder`,
                async (item: BrunoTreeItem) => {
                    const parentFolderPath = item.getPath();
                    const siblingNamesWithoutPrefix =
                        await this.getSiblingNamesForValidatingNewName(
                            parentFolderPath,
                            { isFile: false },
                        );

                    const folderName = await vscode.window.showInputBox({
                        title: `Create folder in '${basename(parentFolderPath)}'`,
                        validateInput: async (newFolderName: string) =>
                            validateNameHasNoPathSeparator(newFolderName) ??
                            (await validateNewItemNameIsUnique(
                                resolve(parentFolderPath, newFolderName),
                            )) ??
                            validateNameIsNotUsedBySibling(
                                newFolderName,
                                siblingNamesWithoutPrefix,
                            ),
                    });

                    if (folderName == undefined) {
                        return;
                    }

                    await promisify(mkdir)(
                        resolve(parentFolderPath, folderName),
                    ).catch(() => {
                        vscode.window.showErrorMessage(
                            `An unexpected error occured.`,
                        );
                    });
                },
            ),
        );
        return result;
    }

    /**
     * The names that a new or renamed item must not use, because they would only differ in the sequence prefix from the ones of its siblings (see `getSiblingNamesWithoutSequencePrefix`).
     * Empty if names are not prefixed with sequences.
     */
    private async getSiblingNamesForValidatingNewName(
        parentFolderPath: string,
        options: { isFile: boolean; excludedPath?: string },
    ) {
        const collection =
            this.itemProvider.getAncestorCollectionForPath(parentFolderPath);

        return shouldPrefixNamesWithSequence() && collection !== undefined
            ? await getSiblingNamesWithoutSequencePrefix(
                  collection,
                  parentFolderPath,
                  options,
              )
            : [];
    }

    private registerCommandForRenamingItem() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.renameItem`,
            async (treeItem: BrunoTreeItem) => {
                const originalPath = treeItem.getPath();
                const isFile = treeItem.isFile;

                if (
                    this.rejectActionForContextRootFolder(
                        originalPath,
                        "renamed",
                    )
                ) {
                    return;
                }

                // If names are prefixed with their sequence, the full name is shown, but the prefix cannot be changed.
                // Only the items that `syncSequencePrefixes` adds a prefix to have one (e.g. not the collection root folder).
                const registeredData =
                    this.itemProvider.getRegisteredItemAndCollection(
                        originalPath,
                    );
                const registeredItem = registeredData?.data.item;
                const registeredSequence =
                    registeredItem &&
                    isCollectionItemWithSequence(registeredItem) &&
                    canNameHaveSequencePrefix(registeredItem) &&
                    !registeredData.collection.isRootDirectory(originalPath) &&
                    !isReservedPath(
                        registeredData.collection,
                        originalPath,
                        isFile,
                    )
                        ? registeredItem.getSequence()
                        : undefined;
                const sequencePrefix =
                    shouldPrefixNamesWithSequence() &&
                    registeredSequence !== undefined &&
                    canSequenceBeUsedAsPrefix(registeredSequence)
                        ? getSequencePrefix(registeredSequence)
                        : undefined;
                // If the current name does not start with the right prefix yet, it gets it when renaming the item.
                const displayedNameWithoutPrefix =
                    registeredItem === undefined || sequencePrefix === undefined
                        ? basename(originalPath)
                        : await getNameWithoutSequencePrefix(registeredItem);
                const displayedName = `${sequencePrefix ?? ""}${displayedNameWithoutPrefix}`;
                // Also needed for items without a prefix, since their name could only differ in the prefix from the one of a sibling with a prefix.
                const siblingNamesWithoutPrefix =
                    await this.getSiblingNamesForValidatingNewName(
                        dirname(originalPath),
                        { isFile, excludedPath: originalPath },
                    );

                // Only the actual name is preselected, without the prefix and the file extension.
                const selectionStart = sequencePrefix?.length ?? 0;
                const selectedName = isFile
                    ? basename(
                          displayedNameWithoutPrefix,
                          extname(originalPath),
                      )
                    : displayedNameWithoutPrefix;

                const newItemName = await vscode.window.showInputBox({
                    title: `Rename ${isFile ? "file" : "folder"} '${basename(
                        originalPath,
                    )}'`,
                    value: displayedName,
                    validateInput: (enteredName: string) =>
                        validateNewNameForRenaming(
                            enteredName,
                            originalPath,
                            sequencePrefix,
                            siblingNamesWithoutPrefix,
                        ),
                    valueSelection: [
                        selectionStart,
                        selectionStart + selectedName.length,
                    ],
                });

                if (newItemName == undefined) {
                    return;
                }

                // The name stored in the file never contains the sequence prefix.
                const newItemNameWithoutPrefix = removeEnteredSequencePrefix(
                    newItemName,
                    sequencePrefix,
                );
                const newPath = resolve(dirname(originalPath), newItemName);

                const itemDataWithcollection =
                    this.itemProvider.getRegisteredItemAndCollection(
                        originalPath,
                    );

                if (!itemDataWithcollection) {
                    if (this.isOutsideCollections(originalPath)) {
                        await this.withProgressInExplorer(
                            `Renaming '${basename(originalPath)}'`,
                            () =>
                                renameFileOrFolder(
                                    this.itemProvider,
                                    originalPath,
                                    newPath,
                                    isFile,
                                    this.logger,
                                ),
                        );
                        return;
                    }

                    vscode.window.showWarningMessage(
                        "Could not find collection for selected item. Aborting renaming operation.",
                    );
                    return;
                }

                const {
                    collection: oldCollection,
                    data: { item: oldItem },
                } = itemDataWithcollection;
                const isCollectionRootFolder =
                    oldCollection.isRootDirectory(originalPath);
                const isRequestFile =
                    isFile &&
                    oldItem.getItemType() == BrunoFileType.RequestFile;

                await this.withProgressInExplorer(
                    `Renaming '${basename(originalPath)}'`,
                    async () => {
                        const renamed = await renameFileOrFolder(
                            this.itemProvider,
                            originalPath,
                            newPath,
                            isFile,
                            this.logger,
                        );

                        if (!renamed) {
                            return;
                        }

                        if (isRequestFile) {
                            await replaceItemName(
                                newPath,
                                newItemNameWithoutPrefix.replace(
                                    getFileExtensionForFormat(
                                        oldCollection.getFormat(),
                                    ),
                                    "",
                                ),
                                oldItem.getItemType(),
                                oldCollection.getFormat(),
                            );
                            return;
                        }

                        if (!isFile) {
                            const folderSettingsPath =
                                await getFolderSettingsFilePath(
                                    isCollectionRootFolder,
                                    newPath,
                                    oldCollection.getFormat(),
                                );

                            if (folderSettingsPath) {
                                await replaceItemName(
                                    folderSettingsPath,
                                    newItemNameWithoutPrefix,
                                    oldItem.getItemType(),
                                    oldCollection.getFormat(),
                                );
                            }

                            if (
                                isCollectionRootFolder &&
                                oldCollection.getFormat() ==
                                    CollectionFormat.Bru
                            ) {
                                await replaceNameInBrunoJson(
                                    getBrunoJsonFilePath(newPath),
                                    newItemName,
                                );
                            }

                            if (isCollectionRootFolder) {
                                await removeConfigForCollection(originalPath);
                            }
                        }
                    },
                );
            },
        );
    }

    private async getPathForDuplicatedItem(originalPath: string) {
        const registeredData =
            this.itemProvider.getRegisteredItemAndCollection(originalPath);

        return await getPathForDuplicatedItem(
            originalPath,
            registeredData &&
                (await getCheckForNamesOfDuplicatedItem(
                    registeredData.collection,
                    registeredData.data.item,
                )),
        );
    }

    private registerCommandForDuplicatingFolder() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFolder`,
            async (item: BrunoTreeItem) => {
                const originalPath = item.getPath();

                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        originalPath,
                    );

                const newFolderPath =
                    await this.getPathForDuplicatedItem(originalPath);

                if (
                    newFolderPath === undefined ||
                    (!collection && !this.isOutsideCollections(originalPath))
                ) {
                    vscode.window.showErrorMessage(
                        `An unexpected error occured.`,
                    );
                    return;
                }

                if (!collection) {
                    await duplicateItemOutsideCollections(
                        originalPath,
                        newFolderPath,
                    );
                    return;
                }

                const previousSequences = await getSequencesBeforeChange(
                    this.itemProvider,
                    [dirname(newFolderPath)],
                );

                await promisify(cp)(
                    item.getPath(),
                    newFolderPath,
                    // @ts-expect-error The TS server somehow does not understand
                    // that there is a `cp` function with up to 4 parameters when using `promisify`.
                    {
                        recursive: true,
                    },
                );

                await updateSettingsFileOfDuplicatedFolder(
                    this.itemProvider,
                    originalPath,
                    newFolderPath,
                );
                await syncSequencePrefixes(
                    this.itemProvider,
                    [dirname(newFolderPath)],
                    {
                        logger: this.logger,
                        previousSequences: addSequenceOfCopiedItem(
                            previousSequences,
                            originalPath,
                            newFolderPath,
                        ),
                        // The files of the duplicated folder are usually not cached yet, but may call requests that are renamed by the sync.
                        uncachedItemPaths: [newFolderPath],
                    },
                );
            },
        );
    }

    private registerCommandForDuplicatingFile() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFile`,
            async (treeItem: BrunoTreeItem) => {
                const targetPath = await this.getPathForDuplicatedItem(
                    treeItem.getPath(),
                );
                const sourceDataAndCollection =
                    this.itemProvider.getRegisteredItemAndCollection(
                        treeItem.getPath(),
                    );

                if (!sourceDataAndCollection) {
                    if (
                        targetPath &&
                        this.isOutsideCollections(treeItem.getPath())
                    ) {
                        if (
                            await duplicateItemOutsideCollections(
                                treeItem.getPath(),
                                targetPath,
                            )
                        ) {
                            await this.openFile(targetPath);
                        }
                        return;
                    }

                    vscode.window.showWarningMessage(
                        "Could not find collection for selected item. Aborting duplicate operation.",
                    );
                    return;
                }

                if (targetPath) {
                    await this.pasteFile(
                        sourceDataAndCollection.data.item,
                        targetPath,
                        {
                            item: sourceDataAndCollection.data.additionalData
                                .treeItem,
                            type: RequestFileInsertionPositionType.AfterFile,
                        },
                    );
                }
            },
        );
    }

    private registerCommandForDeletingItem() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.deleteItem`,
            async (treeItem: BrunoTreeItem) => {
                const path = treeItem.getPath();

                const itemDataWithCollection =
                    this.itemProvider.getRegisteredItemAndCollection(path);

                if (!itemDataWithCollection) {
                    if (
                        this.isOutsideCollections(path) &&
                        !this.rejectActionForContextRootFolder(path, "deleted")
                    ) {
                        await deleteItemOutsideCollections(
                            treeItem,
                            this.confirmationOptionForModals,
                        );
                    }
                    return;
                }

                const {
                    collection,
                    data: { item },
                } = itemDataWithCollection;

                const itemType = item.getItemType();

                const picked = await vscode.window.showInformationMessage(
                    getDeleteConfirmationMessage(
                        `${treeItem.label}`,
                        path,
                        itemType,
                        collection,
                    ),
                    { modal: true },
                    this.confirmationOptionForModals,
                );
                if (picked != this.confirmationOptionForModals) {
                    return;
                }

                const parentFolder = treeItem.isFile
                    ? getFolderWithItemsAffectedByFile(
                          this.itemProvider,
                          path,
                          itemType,
                      )
                    : dirname(path);
                const previousSequences = await getSequencesBeforeChange(
                    this.itemProvider,
                    parentFolder ? [parentFolder] : [],
                );

                await promisify(rm)(path, {
                    recursive: treeItem.isFile ? false : true,
                });
                // Before renumbering, because a remaining item can be renamed to the path of the deleted one then.
                await closeTabsRelatedToItem(treeItem);

                if (collection.isRootDirectory(path)) {
                    await removeConfigForCollection(path);
                    return;
                }

                // ToDo: Replace usage of item provider in called utility functions with passing collection as a parameter directly.
                await updateSequencesAfterDeletingItem(
                    this.itemProvider,
                    { path, itemType, sequence: treeItem.getSequence() },
                    parentFolder,
                    previousSequences,
                    this.logger,
                );
            },
        );
    }

    private registerCommandsForCopyingAndPastingFiles() {
        const result: vscode.Disposable[] = [];

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.copyFile`,
                async (treeItem: BrunoTreeItem) => {
                    const content = await promisify(readFile)(
                        treeItem.getPath(),
                        "utf-8",
                    ).catch(() => undefined);

                    const dataWithCollection =
                        this.itemProvider.getRegisteredItemAndCollection(
                            treeItem.getPath(),
                        );

                    if (content === undefined) {
                        vscode.window.showErrorMessage(
                            `An unexpected error occured while trying to read the file.`,
                        );
                        return;
                    }

                    // Files outside of collections are handled like files that are not Bruno specific.
                    const sourceItem = dataWithCollection
                        ? dataWithCollection.data.item
                        : this.isOutsideCollections(treeItem.getPath())
                          ? new NonBrunoFile(treeItem.getPath())
                          : undefined;

                    if (!sourceItem) {
                        vscode.window.showWarningMessage(
                            "Could not find collection for selected item. Aborting copy operation.",
                        );
                        return;
                    }

                    const baseItemForCopying:
                        CollectionItem | CollectionItemWithSequence = {
                        getItemType: () => sourceItem.getItemType(),
                        getPath: () => sourceItem.getPath(),
                        isFile: () => sourceItem.isFile(),
                    };

                    this.fileToCopy = {
                        content,
                        item: isCollectionItemWithSequence(sourceItem)
                            ? {
                                  ...baseItemForCopying,
                                  getSequence: () => sourceItem.getSequence(),
                              }
                            : { ...baseItemForCopying },
                    };

                    await vscode.commands.executeCommand(
                        "setContext",
                        this.getContextKeyForPasteOption(),
                        true,
                    );
                },
            ),
        );

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.pasteFile`,
                async (targetItem: BrunoTreeItem) => {
                    if (this.fileToCopy == undefined) {
                        return;
                    }

                    const collection =
                        this.itemProvider.getAncestorCollectionForPath(
                            targetItem.getPath(),
                        );
                    if (
                        !collection &&
                        !this.isOutsideCollections(targetItem.getPath())
                    ) {
                        vscode.window.showWarningMessage(
                            "Could not find collection for selected item. Aborting paste operation.",
                        );
                        return;
                    }

                    const { item: sourceItem, content: newContent } =
                        this.fileToCopy;
                    const targetFolder = targetItem.isFile
                        ? dirname(targetItem.getPath())
                        : targetItem.getPath();
                    const targetPath = resolve(
                        targetFolder,
                        basename(sourceItem.getPath()),
                    );

                    const { proceed } =
                        await this.requestConfirmationForOverwritingItemIfNeeded(
                            sourceItem.getPath(),
                            targetPath,
                            collection,
                            true,
                        );

                    if (!proceed) {
                        return;
                    }

                    if (
                        await this.rejectInsertionIfNameIsUsedBySibling(
                            collection,
                            sourceItem,
                            targetFolder,
                            targetPath,
                        )
                    ) {
                        return;
                    }

                    const wasSuccessful = await this.pasteFile(
                        sourceItem,
                        targetPath,
                        targetItem.isFile
                            ? {
                                  item: targetItem,
                                  type: RequestFileInsertionPositionType.AfterFile,
                              }
                            : RequestFileInsertionPositionType.Folder,
                        newContent,
                    );
                    if (wasSuccessful) {
                        this.fileToCopy = undefined;
                        await vscode.commands.executeCommand(
                            "setContext",
                            this.getContextKeyForPasteOption(),
                            false,
                        );
                    }
                },
            ),
        );

        return result;
    }

    private registerCommandsForStartingTestrun(
        startTestRunEmitter: vscode.EventEmitter<{
            uri: vscode.Uri;
            withDialog: boolean;
        }>,
    ) {
        const result: vscode.Disposable[] = [];

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.startTestRun`,
                (item: BrunoTreeItem) => {
                    startTestRunEmitter.fire({
                        uri: vscode.Uri.file(item.getPath()),
                        withDialog: false,
                    });
                },
            ),
        );

        result.push(
            vscode.commands.registerCommand(
                `${this.treeViewId}.openDialogForTestRun`,
                (item: BrunoTreeItem) => {
                    startTestRunEmitter.fire({
                        uri: vscode.Uri.file(item.getPath()),
                        withDialog: true,
                    });
                },
            ),
        );

        return result;
    }

    private registerCommandForEnvironmentSelection() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.selectEnvironmentForCollection`,
            async (itemPath: string) => {
                const collection =
                    this.itemProvider.getAncestorCollectionForPath(itemPath);

                if (!collection) {
                    vscode.window.showErrorMessage(
                        "Could not find collection for selected item.",
                    );
                    return;
                }

                const wasUpdated = await showDialogForSettingEnvironment(
                    collection,
                    getConfiguredEnvironmentName(
                        collection.getRootDirectory(),
                        (sectionKey) =>
                            vscode.workspace.getConfiguration().get(sectionKey),
                    ),
                );

                if (wasUpdated) {
                    vscode.window.withProgress(
                        { location: { viewId: this.treeViewId } },
                        () => {
                            // Since a change of the selected environment is not reflected directly in the file system,
                            // we need to trigger a reload for the explorer to show the current data.
                            return this.itemProvider.reloadCollectionRootFolderItem(
                                itemPath,
                            );
                        },
                    );
                }
            },
        );
    }

    private registerCommandForNormalizingSequences() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.normalizeSequences`,
            async (treeItem: BrunoTreeItem) => {
                if (!treeItem || treeItem.isFile) {
                    return;
                }

                const selectedPath = treeItem.getPath();
                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        selectedPath,
                    );

                if (!collection) {
                    vscode.window.showErrorMessage(
                        "Could not find collection for selected item.",
                    );
                    return;
                }

                const configuredStep = vscode.workspace
                    .getConfiguration()
                    .get<number>("bru-as-code.sequenceStep", 1);
                const sequenceStep = await selectSequenceStep(
                    basename(selectedPath),
                    configuredStep,
                );

                if (sequenceStep === undefined) {
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: { viewId: this.treeViewId },
                        title: "Normalizing sequences",
                    },
                    () =>
                        normalizeSequencesRecursively(
                            this.itemProvider,
                            collection,
                            selectedPath,
                            sequenceStep,
                            this.logger,
                        ),
                );
            },
        );
    }

    private registerCommandForRemovingSequencePrefixes() {
        return vscode.commands.registerCommand(
            `${this.treeViewId}.removeSequencePrefixes`,
            async (treeItem: BrunoTreeItem) => {
                if (!treeItem || treeItem.isFile) {
                    return;
                }

                const selectedPath = treeItem.getPath();
                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        selectedPath,
                    );

                if (!collection) {
                    vscode.window.showErrorMessage(
                        "Could not find collection for selected item.",
                    );
                    return;
                }

                const picked = await vscode.window.showInformationMessage(
                    `Remove the sequence prefixes from the names of all requests and folders below '${basename(selectedPath)}'?`,
                    { modal: true },
                    this.confirmationOptionForModals,
                );

                if (picked != this.confirmationOptionForModals) {
                    return;
                }

                const { renamedCount, skippedCount, failed } =
                    await this.withProgressInExplorer(
                        "Removing sequence prefixes",
                        () =>
                            removeSequencePrefixesRecursively(
                                this.itemProvider,
                                collection,
                                selectedPath,
                                this.logger,
                            ),
                    );

                if (failed) {
                    // The error has already been shown.
                    return;
                }

                const skippedHint =
                    skippedCount == 0
                        ? ""
                        : ` ${skippedCount} item${skippedCount == 1 ? " was" : "s were"} not renamed, because an item with the name without the prefix already exists or the name is reserved.`;

                vscode.window.showInformationMessage(
                    renamedCount == 0 && skippedCount == 0
                        ? "No sequence prefixes found."
                        : `Removed the sequence prefix from ${renamedCount} item${renamedCount == 1 ? "" : "s"}.${skippedHint}`,
                );
            },
        );
    }

    /** Used by the quick fix for names that do not match the sequence of the item. */
    private registerCommandForRenamingToMatchSequence() {
        return vscode.commands.registerCommand(
            renameItemToMatchSequenceCommand,
            async (sourcePath: string, targetPath: string, isFile: boolean) => {
                if (
                    typeof sourcePath != "string" ||
                    typeof targetPath != "string" ||
                    typeof isFile != "boolean"
                ) {
                    return;
                }

                if (await checkIfPathExistsAsync(targetPath)) {
                    vscode.window.showWarningMessage(
                        `Cannot rename to '${basename(targetPath)}', because an item with this name already exists.`,
                    );
                    return;
                }

                await this.withProgressInExplorer(
                    `Renaming '${basename(sourcePath)}'`,
                    () =>
                        renameFileOrFolder(
                            this.itemProvider,
                            sourcePath,
                            targetPath,
                            isFile,
                            this.logger,
                        ),
                );
            },
        );
    }

    private async tryToRevealItem(
        path: string,
        treeView: vscode.TreeView<BrunoTreeItem>,
        logger?: OutputChannelLogger,
    ) {
        await this.itemProvider.ensureCacheIsLoaded();

        const maybeCollection =
            this.itemProvider.getAncestorCollectionForPath(path);

        if (
            !maybeCollection &&
            this.contextRootProvider.findContextRootForPath(path)
        ) {
            await this.tryToRevealItemInContextRoot(path, treeView, logger);
            return;
        }

        if (
            maybeCollection &&
            // Sometimes when e.g. renaming a folder, the descendant file paths may not have been updated in the collection yet.
            maybeCollection.getStoredDataForPath(path)
        ) {
            const treeItem = (
                maybeCollection.getStoredDataForPath(
                    path,
                ) as TypedCollectionData
            ).additionalData.treeItem;

            this.logger?.debug(
                `Starting attempt of revealing item '${
                    treeItem.path
                }' in collection explorer for collection '${basename(
                    maybeCollection.getRootDirectory(),
                )}'.`,
            );

            try {
                await treeView.reveal(treeItem);
            } catch (e) {
                if (e instanceof Error) {
                    logger?.warn(
                        `Caught error while trying to reveal treeItem '${treeItem.getPath()}': ${e.message}`,
                    );
                } else {
                    logger?.warn(
                        `Caught unkown type of exception while trying to reveal item '${treeItem.getPath()}'`,
                    );
                }
            }
        }
    }

    private async tryToRevealItemInContextRoot(
        path: string,
        treeView: vscode.TreeView<BrunoTreeItem>,
        logger?: OutputChannelLogger,
    ) {
        const stats = await stat(path).catch(() => undefined);

        if (!stats) {
            return;
        }

        const treeItem = this.contextRootProvider.getOrCreateItem(
            path,
            !stats.isDirectory(),
        );

        try {
            await treeView.reveal(treeItem);
        } catch (e) {
            logger?.warn(
                `Caught error while trying to reveal item '${path}' of an additional context root: ${
                    e instanceof Error ? e.message : e
                }`,
            );
        }
    }

    private async pasteFile(
        sourceItem: CollectionItem,
        targetPath: string,
        insertionPosition: FileInsertionPosition,
        newContent?: string,
    ) {
        const targetCollection =
            this.itemProvider.getAncestorCollectionForPath(targetPath);

        if (!targetCollection) {
            if (!this.isOutsideCollections(targetPath)) {
                return false;
            }

            const wasSuccessful = await pasteFileOutsideCollections(
                sourceItem.getPath(),
                targetPath,
                newContent,
            );

            if (wasSuccessful) {
                await this.openFile(targetPath);
            }

            return wasSuccessful;
        }

        const finalPath = await insertFileAndSyncSequencePrefixes(
            this.itemProvider,
            sourceItem,
            { newPath: targetPath, insertionPosition },
            newContent,
            this.logger,
        );

        if (finalPath == undefined) {
            return false;
        }

        // After the new file has been registered in the cache, the explorer should be able to reveal it when opened in the editor.
        await this.cacheSyncingHelper.waitForFileToBeRegisteredInCache(
            targetCollection.getRootDirectory(),
            finalPath,
        );
        await this.openFile(finalPath);

        return true;
    }

    /**
     * @returns Whether to proceed with the operation, and whether the user has agreed to overwrite an existing item.
     * Only replace an existing item if `overwrite` is true, since there may be items on disk that the user was not asked about.
     */
    private async requestConfirmationForOverwritingItemIfNeeded(
        sourcePath: string,
        newPath: string,
        targetCollection?: TypedCollection,
        // confirmation should not be required in most cases, e.g. when moving a request within the same folder (e.g. to update the sequence).
        confirmOnOverwritingSourceItem = false,
    ) {
        // Outside of collections, there are no registered items.
        const targetExists = targetCollection
            ? this.itemProvider.getRegisteredItem(targetCollection, newPath) !=
              undefined
            : await checkIfPathExistsAsync(newPath);
        const needsConfirmation =
            targetExists &&
            (confirmOnOverwritingSourceItem
                ? true
                : normalizePath(newPath) != normalizePath(sourcePath));

        if (!needsConfirmation) {
            return { proceed: true, overwrite: false };
        }

        const pickedOption = await vscode.window.showInformationMessage(
            `An item with the path '${newPath}' already exists. Do you want to overwrite it?`,
            { modal: true },
            this.confirmationOptionForModals,
        );

        const isConfirmed = pickedOption == this.confirmationOptionForModals;

        return { proceed: isConfirmed, overwrite: isConfirmed };
    }

    private async writeFileAndOpenItOnSuccess(
        filePath: string,
        content: string,
    ) {
        const failed = await promisify(writeFile)(filePath, content).catch(
            () => {
                vscode.window.showErrorMessage(`An unexpected error occured.`);
                return true;
            },
        );

        if (!failed) {
            await this.openFile(filePath);
        }

        return !failed;
    }

    private openFile(path: string, viewColum?: vscode.ViewColumn) {
        return vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(path),
            viewColum,
        );
    }

    private getContextKeyForPasteOption() {
        return "BruAsCode.canPasteFile";
    }
}
