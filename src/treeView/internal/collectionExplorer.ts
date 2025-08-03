import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    getMaxSequenceForRequests,
    CollectionItemProvider,
    CollectionData,
    normalizeDirectoryPath,
    getExtensionForBrunoFiles,
    OutputChannelLogger,
    getSequenceForFile,
    BrunoFileType,
    Collection,
    getSequenceForFolder,
    getMaxSequenceForFolders,
    getFolderSettingsFilePath,
    checkIfPathExistsAsync,
    CollectionFile,
    isBrunoFileType,
    getConfirmationOptionLabel,
} from "../../shared";
import { basename, dirname, extname, resolve } from "path";
import { BrunoTreeItem } from "../brunoTreeItem";
import { validateNewItemNameIsUnique } from "./explorer/validateNewItemNameIsUnique";
import { createRequestFile } from "./explorer/fileUtils/createRequestFile";
import { replaceNameInMetaBlock } from "./explorer/fileUtils/replaceNameInMetaBlock";
import { getPathForDuplicatedItem } from "./explorer/getPathForDuplicatedItem";
import { renameFileOrFolder } from "./explorer/renameFileOrFolder";
import { replaceSequenceForFile } from "./explorer/fileUtils/replaceSequenceForFile";
import { normalizeSequencesForRequestFiles } from "./explorer/fileUtils/normalizeSequencesForRequestFiles";
import { normalizeSequencesForFolders } from "./explorer/folderUtils/normalizeSequencesForFolders";
import { moveFolderIntoTargetFolder } from "./explorer/folderUtils/moveFolderIntoTargetFolder";
import { FolderDropInsertionOption } from "./explorer/folderDropInsertionOptionEnum";
import { moveFileIntoFolder } from "./explorer/fileUtils/moveFileIntoFolder";
import { promisify } from "util";
import { copyFile, cp, mkdir, rm, writeFile } from "fs";
import { closeTabsRelatedToItem } from "./explorer/closeTabsRelatedToItem";

export class CollectionExplorer
    implements vscode.TreeDragAndDropController<BrunoTreeItem>
{
    private treeViewId = "brunoCollectionsView";
    dragMimeTypes = ["text/uri-list"];
    dropMimeTypes = [`application/vnd.code.tree.${this.treeViewId}`];

    constructor(
        private itemProvider: CollectionItemProvider,
        startTestRunEmitter: vscode.EventEmitter<vscode.Uri>,
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
        const treeDataProvider = new BrunoTreeItemProvider(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            itemProvider,
            logger,
        );

        const treeView = vscode.window.createTreeView(this.treeViewId, {
            treeDataProvider,
            dragAndDropController: this,
        });

        this.registerCommands(treeDataProvider, startTestRunEmitter);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(async (e) => {
                await this.handleChangedTextEditor(e, treeView);
            }),
        );
    }

    private disposables: vscode.Disposable[] = [];
    private confirmationOptionForModals = getConfirmationOptionLabel();

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
                treeItem: originalTreeItem,
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
                !(await this.requestConfirmationForOverwritingItemIfNeeded(
                    sourcePath,
                    newPath,
                    targetCollection,
                ))
            ) {
                return;
            }

            const fileType = (originalItem as CollectionFile).getFileType();

            if (isBrunoFileType(fileType)) {
                await moveFileIntoFolder(
                    this.itemProvider,
                    sourcePath,
                    newPath,
                    target,
                    dirname(newPath),
                    fileType,
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
                !(await this.requestConfirmationForOverwritingItemIfNeeded(
                    sourcePath,
                    newPath,
                    targetCollection,
                ))
            ) {
                return;
            }

            await moveFolderIntoTargetFolder(
                this.itemProvider,
                sourcePath,
                target,
                FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
                originalTreeItem.getSequence(),
            );
            return;
        }

        const pickedOption = await vscode.window.showInformationMessage(
            `Where should the folder '${basename(sourcePath)}' be inserted?`,
            { modal: true },
            ...Object.values(FolderDropInsertionOption),
        );

        if (
            !pickedOption ||
            (pickedOption ==
                FolderDropInsertionOption.MoveIntoTargetAsSubfolder &&
                !(await this.requestConfirmationForOverwritingItemIfNeeded(
                    sourcePath,
                    // With the insertion option of moving into the target folder, the new item path is the same as if moving a file.
                    resolve(target.getPath(), basename(sourcePath)),
                    targetCollection,
                )))
        ) {
            return;
        }

        await moveFolderIntoTargetFolder(
            this.itemProvider,
            sourcePath,
            target,
            pickedOption,
            originalTreeItem.getSequence(),
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
        ) as CollectionData;

        const targetCollection = this.itemProvider.getAncestorCollectionForPath(
            target.getPath(),
        );

        return {
            originalItemData,
            sourcePath: originalItemData.item.getPath(),
            targetCollection,
            target,
        };
    }

    private async requestConfirmationForOverwritingItemIfNeeded(
        sourcePath: string,
        newPath: string,
        targetCollection?: Collection,
    ) {
        if (
            targetCollection &&
            this.itemProvider.getRegisteredItem(targetCollection, newPath) &&
            normalizeDirectoryPath(newPath) !=
                normalizeDirectoryPath(sourcePath) // confirmation should not be required when moving a request within the same folder (e.g. to update the sequence)
        ) {
            const pickedOption = await vscode.window.showInformationMessage(
                `An item with the path '${newPath}' already exists. Do you want to overwrite it?`,
                { modal: true },
                this.confirmationOptionForModals,
            );

            return pickedOption == this.confirmationOptionForModals;
        }

        return true;
    }

    private registerCommands(
        treeDataProvider: BrunoTreeItemProvider,
        startTestRunEmitter: vscode.EventEmitter<vscode.Uri>,
    ) {
        vscode.commands.registerCommand(`${this.treeViewId}.refresh`, () => {
            vscode.window.withProgress(
                { location: { viewId: this.treeViewId } },
                () => {
                    return treeDataProvider.refresh();
                },
            );
        });

        vscode.commands.registerCommand(
            `${this.treeViewId}.openInNewTabgroup`,
            (item: BrunoTreeItem) => {
                vscode.commands.executeCommand(
                    "vscode.open",
                    vscode.Uri.file(item.getPath()),
                    vscode.ViewColumn.Beside,
                );
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createEmptyFile`,
            async (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                const fileName = await vscode.window.showInputBox({
                    title: `Create file in '${basename(parentFolderPath)}'`,
                    validateInput: (newFileName: string) => {
                        return validateNewItemNameIsUnique(
                            resolve(parentFolderPath, newFileName),
                        );
                    },
                });

                if (fileName == undefined) {
                    return;
                }

                const filePath = resolve(parentFolderPath, fileName);
                await promisify(writeFile)(filePath, "");

                await vscode.commands.executeCommand(
                    "vscode.open",
                    vscode.Uri.file(filePath),
                );
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createRequestFile`,
            (item: BrunoTreeItem) => {
                createRequestFile(this.itemProvider, item);
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createFolder`,
            async (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                const folderName = await vscode.window.showInputBox({
                    title: `Create folder in '${basename(parentFolderPath)}'`,
                    validateInput: (newFolderName: string) => {
                        return validateNewItemNameIsUnique(
                            resolve(parentFolderPath, newFolderName),
                        );
                    },
                });

                if (folderName == undefined) {
                    return;
                }

                await promisify(mkdir)(resolve(parentFolderPath, folderName));
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.renameItem`,
            async (treeItem: BrunoTreeItem) => {
                const originalPath = treeItem.getPath();
                const isFile = treeItem.isFile;

                const originalName =
                    isFile && extname(originalPath) != ""
                        ? basename(originalPath).substring(
                              0,
                              basename(originalPath).indexOf(
                                  extname(originalPath),
                              ),
                          )
                        : basename(originalPath);

                const newItemName = await vscode.window.showInputBox({
                    title: `Rename ${isFile ? "file" : "folder"} '${basename(
                        originalPath,
                    )}'`,
                    value: basename(originalPath),
                    validateInput: (newItemName: string) => {
                        return validateNewItemNameIsUnique(
                            resolve(dirname(originalPath), newItemName),
                            originalPath,
                        );
                    },
                    valueSelection: [0, originalName.length],
                });

                if (newItemName == undefined) {
                    return;
                }

                const newPath = resolve(dirname(originalPath), newItemName);

                const itemDataWithcollection =
                    this.itemProvider.getRegisteredItemAndCollection(
                        originalPath,
                    );

                const isRequestFile =
                    itemDataWithcollection &&
                    isFile &&
                    (
                        itemDataWithcollection.data.item as CollectionFile
                    ).getFileType() == BrunoFileType.RequestFile;

                const renamed = await renameFileOrFolder(
                    originalPath,
                    newPath,
                    isFile,
                );

                if (!renamed) {
                    return;
                }

                if (isRequestFile) {
                    await replaceNameInMetaBlock(
                        newPath,
                        newItemName.replace(getExtensionForBrunoFiles(), ""),
                    );
                } else if (!isFile) {
                    const folderSettingsPath =
                        await getFolderSettingsFilePath(newPath);

                    if (folderSettingsPath) {
                        await replaceNameInMetaBlock(
                            folderSettingsPath,
                            newItemName,
                        );
                    }
                }
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFolder`,
            async (item: BrunoTreeItem) => {
                const originalPath = item.getPath();

                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        item.getPath(),
                    );

                if (!collection) {
                    vscode.window.showErrorMessage(
                        `An unexpected error occured. Failed to determine collection for item with path '${item.getPath()}'`,
                    );
                    return;
                }

                const newFolderPath =
                    await getPathForDuplicatedItem(originalPath);

                // @ts-expect-error The TS server somehow does not understand
                // that there is a `cp` function with up to 4 parameters when using `promisify`.
                await promisify(cp)(item.getPath(), newFolderPath, {
                    recursive: true,
                });

                const newFolderSettingsFile =
                    await getFolderSettingsFilePath(newFolderPath);

                if (
                    (await getSequenceForFolder(
                        collection.getRootDirectory(),
                        originalPath,
                    )) &&
                    newFolderSettingsFile
                ) {
                    await replaceSequenceForFile(
                        newFolderSettingsFile,
                        1 +
                            ((await getMaxSequenceForFolders(
                                this.itemProvider,
                                dirname(originalPath),
                            )) ?? 0),
                    );

                    await replaceNameInMetaBlock(
                        newFolderSettingsFile,
                        basename(newFolderPath),
                    );
                }
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFile`,
            async (treeItem: BrunoTreeItem) => {
                const itemDataWithCollection =
                    this.itemProvider.getRegisteredItemAndCollection(
                        treeItem.getPath(),
                    );

                if (!itemDataWithCollection) {
                    return;
                }

                const { collection } = itemDataWithCollection;

                const fileType = (
                    itemDataWithCollection.data.item as CollectionFile
                ).getFileType();

                if (
                    fileType != BrunoFileType.CollectionSettingsFile &&
                    fileType != BrunoFileType.FolderSettingsFile
                ) {
                    const newPath = await this.duplicateFile(
                        collection,
                        treeItem,
                    );

                    await replaceNameInMetaBlock(
                        newPath,
                        basename(newPath).replace(
                            getExtensionForBrunoFiles(),
                            "",
                        ),
                    );
                } else if (fileType == BrunoFileType.CollectionSettingsFile) {
                    const confirmed = await this.showWarningDialog(
                        "Duplicate collection settings file?",
                        "Only one collection settings file can be defined per collection.",
                    );

                    if (confirmed) {
                        await this.duplicateFile(collection, treeItem);
                    }
                } else {
                    const confirmed = await this.showWarningDialog(
                        "Duplicate folder settings file?",
                        "Only one folder settings file can be defined per folder.",
                    );

                    if (confirmed) {
                        await this.duplicateFile(collection, treeItem);
                    }
                }
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.deleteItem`,
            async (item: BrunoTreeItem) => {
                const picked = await vscode.window.showInformationMessage(
                    `Delete '${item.label}'?`,
                    { modal: true },
                    this.confirmationOptionForModals,
                );
                if (picked != this.confirmationOptionForModals) {
                    return;
                }
                const path = item.getPath();

                const itemDataWithCollection =
                    this.itemProvider.getRegisteredItemAndCollection(path);

                const fileType =
                    itemDataWithCollection &&
                    itemDataWithCollection.data.item instanceof CollectionFile
                        ? itemDataWithCollection.data.item.getFileType()
                        : undefined;

                await promisify(rm)(item.getPath(), {
                    recursive: item.isFile ? false : true,
                });

                if (
                    fileType == BrunoFileType.RequestFile &&
                    (await checkIfPathExistsAsync(dirname(path)))
                ) {
                    await normalizeSequencesForRequestFiles(
                        this.itemProvider,
                        dirname(path),
                    );
                } else if (
                    (fileType == BrunoFileType.FolderSettingsFile ||
                        (!fileType && !item.isFile && item.getSequence())) &&
                    (await checkIfPathExistsAsync(dirname(path)))
                ) {
                    normalizeSequencesForFolders(
                        this.itemProvider,
                        fileType == BrunoFileType.FolderSettingsFile
                            ? dirname(dirname(path))
                            : dirname(path),
                    );
                }
                await closeTabsRelatedToItem(item);
            },
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.startTestRun`,
            (item: BrunoTreeItem) => {
                startTestRunEmitter.fire(vscode.Uri.file(item.getPath()));
            },
        );
    }

    private async duplicateFile(collection: Collection, item: BrunoTreeItem) {
        const originalPath = item.getPath();
        const newPath = await getPathForDuplicatedItem(originalPath);

        await promisify(copyFile)(originalPath, newPath);

        if (await getSequenceForFile(collection, originalPath)) {
            await replaceSequenceForFile(
                newPath,
                (await getMaxSequenceForRequests(
                    this.itemProvider,
                    dirname(originalPath),
                )) + 1,
            );
        }

        return newPath;
    }

    private async showWarningDialog(modalMessage: string, detailText: string) {
        const picked = await vscode.window.showWarningMessage(
            modalMessage,
            {
                modal: true,
                detail: detailText,
            },
            this.confirmationOptionForModals,
        );

        return picked == this.confirmationOptionForModals;
    }

    private async handleChangedTextEditor(
        e: vscode.TextEditor | undefined,
        treeView: vscode.TreeView<BrunoTreeItem>,
    ) {
        if (
            e &&
            treeView.visible &&
            (await checkIfPathExistsAsync(e.document.uri.fsPath))
        ) {
            const maybeCollection =
                this.itemProvider.getAncestorCollectionForPath(
                    e.document.uri.fsPath,
                );

            if (
                maybeCollection &&
                // Sometimes when e.g. renaming a folder, the descendant file paths may not have been updated in the collection yet.
                maybeCollection.getStoredDataForPath(e.document.uri.fsPath)
            ) {
                const treeItem = (
                    maybeCollection.getStoredDataForPath(
                        e.document.uri.fsPath,
                    ) as CollectionData
                ).treeItem;

                this.logger?.debug(
                    `Starting first attempt of revealing item '${
                        treeItem.path
                    }' in explorer for collection '${basename(
                        maybeCollection.getRootDirectory(),
                    )}'.`,
                );

                await treeView.reveal(treeItem);

                // Sometimes the 'reveal' command does not actually reveal the item, in that case it is retried once
                if (
                    !treeView.selection.some(
                        (item) => item.getPath() == e.document.uri.fsPath,
                    )
                ) {
                    this.logger?.debug(
                        `Starting second attempt of revealing item '${
                            treeItem.path
                        }' in explorer for collection '${basename(
                            maybeCollection.getRootDirectory(),
                        )}'.`,
                    );

                    await treeView.reveal(treeItem);
                }
            }
        }
    }
}
