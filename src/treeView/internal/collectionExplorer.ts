import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    getSequencesForRequests,
    getMaxSequenceForRequests,
    CollectionItemProvider,
    CollectionData,
    normalizeDirectoryPath,
    getExtensionForRequestFiles,
    OutputChannelLogger,
    getSequenceForFile,
    getTypeOfBrunoFile,
    BrunoFileType,
    Collection,
    getSequenceForFolder,
    getMaxSequenceForFolders,
    getFolderSettingsFilePath,
} from "../../shared";
import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { basename, dirname, extname, resolve } from "path";
import { BrunoTreeItem } from "../brunoTreeItem";
import { validateNewItemNameIsUnique } from "./explorer/validateNewItemNameIsUnique";
import { createRequestFile } from "./explorer/createRequestFile";
import { replaceNameInRequestFile } from "./explorer/replaceNameInRequestFile";
import { getPathForDuplicatedItem } from "./explorer/getPathForDuplicatedItem";
import { renameFileOrFolder } from "./explorer/renameFileOrFolder";
import { replaceSequenceForFile } from "./explorer/replaceSequenceForFile";
import { normalizeSequencesForRequestFiles } from "./explorer/normalizeSequencesForRequestFiles";
import { normalizeSequencesForFolders } from "./explorer/normalizeSequencesForFolders";

export class CollectionExplorer
    implements vscode.TreeDragAndDropController<BrunoTreeItem>
{
    private treeViewId = "brunoCollectionsView";
    dragMimeTypes = ["text/uri-list"];
    dropMimeTypes = [`application/vnd.code.tree.${this.treeViewId}`];

    constructor(
        private itemProvider: CollectionItemProvider,
        startTestRunEmitter: vscode.EventEmitter<vscode.Uri>,
        private logger?: OutputChannelLogger
    ) {
        if (
            !vscode.workspace.workspaceFolders ||
            vscode.workspace.workspaceFolders.length == 0
        ) {
            throw new Error(
                "Activation of collection explorer failed because no workspace folders were found!"
            );
        }
        const treeDataProvider = new BrunoTreeItemProvider(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            itemProvider,
            logger
        );

        const treeView = vscode.window.createTreeView(this.treeViewId, {
            treeDataProvider,
            dragAndDropController: this,
        });

        this.registerCommands(treeDataProvider, startTestRunEmitter);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((e) => {
                this.handleChangedTextEditor(e, treeView);
            })
        );
    }

    private disposables: vscode.Disposable[] = [];

    private confirmationOptionForModals = "Confirm";

    public dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    handleDrag(
        source: readonly BrunoTreeItem[],
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
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
        target: BrunoTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ) {
        const item = dataTransfer.get("text/uri-list");

        if (!item || !target || !existsSync(target.getPath())) {
            return;
        }

        const sourcePath = await item.asString();
        const newPath = resolve(
            this.getTargetDirectoryForDragAndDrop(target),
            basename(sourcePath)
        );
        const newCollection =
            this.itemProvider.getAncestorCollectionForPath(newPath);

        if (
            newCollection &&
            this.itemProvider.getRegisteredItem(newCollection, newPath) &&
            normalizeDirectoryPath(newPath) !=
                normalizeDirectoryPath(sourcePath) // confirmation should not be required when moving a request within the same folder (e.g. to update the sequence)
        ) {
            if (
                !(await vscode.window.showInformationMessage(
                    `An item with the path '${newPath}' already exists. Do you want to overwrite it?`,
                    { modal: true },
                    "Confirm"
                ))
            ) {
                return;
            }
        }

        const isFile = (item.value as BrunoTreeItem).isFile;

        renameFileOrFolder(sourcePath, newPath, isFile).then((renamed) => {
            // ToDo: If the file was a folder settings file, update sequences for parent folder and other folders
            if (
                renamed &&
                isFile &&
                extname(newPath) == getExtensionForRequestFiles()
            ) {
                // Only when moving a file, sequences of requests may need to be adjusted
                this.updateSequencesAfterMovingFile(target, sourcePath);
            }
        });
    }

    private registerCommands(
        treeDataProvider: BrunoTreeItemProvider,
        startTestRunEmitter: vscode.EventEmitter<vscode.Uri>
    ) {
        vscode.commands.registerCommand(`${this.treeViewId}.refresh`, () => {
            vscode.window.withProgress(
                { location: { viewId: this.treeViewId } },
                () => {
                    return treeDataProvider.refresh();
                }
            );
        });

        vscode.commands.registerCommand(
            `${this.treeViewId}.openInNewTabgroup`,
            (item: BrunoTreeItem) => {
                vscode.commands.executeCommand(
                    "vscode.open",
                    vscode.Uri.file(item.getPath()),
                    vscode.ViewColumn.Beside
                );
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createEmptyFile`,
            (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                vscode.window
                    .showInputBox({
                        title: `Create file in '${basename(parentFolderPath)}'`,
                        validateInput: (newFileName: string) => {
                            return validateNewItemNameIsUnique(
                                resolve(parentFolderPath, newFileName)
                            );
                        },
                    })
                    .then((fileName) => {
                        if (fileName == undefined) {
                            return;
                        }

                        const filePath = resolve(parentFolderPath, fileName);
                        writeFileSync(filePath, "");

                        vscode.commands.executeCommand(
                            "vscode.open",
                            vscode.Uri.file(filePath)
                        );
                    });
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createRequestFile`,
            (item: BrunoTreeItem) => {
                createRequestFile(this.itemProvider, item);
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.createFolder`,
            (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                vscode.window
                    .showInputBox({
                        title: `Create folder in '${basename(
                            parentFolderPath
                        )}'`,
                        validateInput: (newFolderName: string) => {
                            return validateNewItemNameIsUnique(
                                resolve(parentFolderPath, newFolderName)
                            );
                        },
                    })
                    .then((folderName) => {
                        if (folderName == undefined) {
                            return;
                        }

                        mkdirSync(resolve(parentFolderPath, folderName));
                    });
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.renameItem`,
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();
                const isFile = item.isFile;
                const originalName =
                    isFile && extname(originalPath) != ""
                        ? basename(originalPath).substring(
                              0,
                              basename(originalPath).indexOf(
                                  extname(originalPath)
                              )
                          )
                        : basename(originalPath);

                vscode.window
                    .showInputBox({
                        title: `Rename ${
                            isFile ? "file" : "folder"
                        } '${basename(originalPath)}'`,
                        value: basename(originalPath),
                        validateInput: (newItemName: string) => {
                            return validateNewItemNameIsUnique(
                                resolve(dirname(originalPath), newItemName),
                                originalPath
                            );
                        },
                        valueSelection: [0, originalName.length],
                    })
                    .then((newItemName) => {
                        if (newItemName == undefined) {
                            return;
                        }

                        const newPath = resolve(
                            dirname(originalPath),
                            newItemName
                        );

                        renameFileOrFolder(originalPath, newPath, isFile).then(
                            (renamed) => {
                                if (
                                    renamed &&
                                    isFile &&
                                    extname(newPath) ==
                                        getExtensionForRequestFiles()
                                ) {
                                    replaceNameInRequestFile(newPath);
                                }
                            }
                        );
                    });
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFolder`,
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();

                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        item.getPath()
                    );

                if (!collection) {
                    vscode.window.showErrorMessage(
                        `An unexpected error occured. Failed to determine collection for item with path '${item.getPath()}'`
                    );
                    return;
                }

                const newFolderPath = getPathForDuplicatedItem(originalPath);

                cpSync(item.getPath(), newFolderPath, {
                    recursive: true,
                });

                const newFolderSettingsFile =
                    getFolderSettingsFilePath(newFolderPath);

                if (
                    getSequenceForFolder(
                        collection.getRootDirectory(),
                        originalPath
                    ) &&
                    newFolderSettingsFile
                ) {
                    replaceSequenceForFile(
                        newFolderSettingsFile,
                        getMaxSequenceForFolders(
                            this.itemProvider,
                            dirname(originalPath)
                        ) + 1
                    );
                }
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFile`,
            (item: BrunoTreeItem) => {
                const collection =
                    this.itemProvider.getAncestorCollectionForPath(
                        item.getPath()
                    );

                if (collection) {
                    const brunoFileType = getTypeOfBrunoFile(
                        [collection],
                        item.getPath()
                    );

                    if (
                        brunoFileType != BrunoFileType.CollectionSettingsFile &&
                        brunoFileType != BrunoFileType.FolderSettingsFile
                    ) {
                        this.duplicateFile(collection, item);
                    } else if (
                        brunoFileType == BrunoFileType.CollectionSettingsFile
                    ) {
                        this.showWarningDialog(
                            "Duplicate collection settings file?",
                            "Only one collection settings file can be defined per collection."
                        ).then((confirmed) => {
                            if (confirmed) {
                                this.duplicateFile(collection, item);
                            }
                        });
                    } else {
                        this.showWarningDialog(
                            "Duplicate folder settings file?",
                            "Only one folder settings file can be defined per folder."
                        ).then((confirmed) => {
                            if (confirmed) {
                                this.duplicateFile(collection, item);
                            }
                        });
                    }
                }
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.deleteItem`,
            (item: BrunoTreeItem) => {
                vscode.window
                    .showInformationMessage(
                        `Delete '${item.label}'?`,
                        { modal: true },
                        this.confirmationOptionForModals
                    )
                    .then((picked) => {
                        if (picked != this.confirmationOptionForModals) {
                            return;
                        }
                        const path = item.getPath();

                        const workspaceEdit = new vscode.WorkspaceEdit();
                        workspaceEdit.deleteFile(
                            vscode.Uri.file(item.getPath()),
                            { recursive: true }
                        );

                        const collection =
                            this.itemProvider.getAncestorCollectionForPath(
                                path
                            );

                        const brunoFileType = collection
                            ? getTypeOfBrunoFile([collection], path)
                            : undefined;

                        vscode.workspace
                            .applyEdit(workspaceEdit)
                            .then((deleted) => {
                                if (
                                    deleted &&
                                    brunoFileType ==
                                        BrunoFileType.RequestFile &&
                                    existsSync(dirname(path))
                                ) {
                                    normalizeSequencesForRequestFiles(
                                        this.itemProvider,
                                        dirname(path)
                                    );
                                } else if (
                                    deleted &&
                                    (brunoFileType ==
                                        BrunoFileType.FolderSettingsFile ||
                                        (!brunoFileType && !item.isFile)) &&
                                    existsSync(dirname(path))
                                ) {
                                    normalizeSequencesForFolders(
                                        this.itemProvider,
                                        brunoFileType ==
                                            BrunoFileType.FolderSettingsFile
                                            ? dirname(dirname(path))
                                            : dirname(path)
                                    );
                                }
                            });
                    });
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.startTestRun`,
            (item: BrunoTreeItem) => {
                startTestRunEmitter.fire(vscode.Uri.file(item.getPath()));
            }
        );
    }

    private updateSequencesAfterMovingFile(
        target: BrunoTreeItem,
        sourcePath: string
    ) {
        const targetDirectory = this.getTargetDirectoryForDragAndDrop(target);
        const newPath = resolve(targetDirectory, basename(sourcePath));

        const newSequence = target.isFile
            ? target.getSequence()
                ? (target.getSequence() as number) + 1
                : getMaxSequenceForRequests(
                      this.itemProvider,
                      targetDirectory
                  ) + 1
            : getMaxSequenceForRequests(this.itemProvider, targetDirectory) + 1;

        replaceSequenceForFile(newPath, newSequence);

        if (target.isFile) {
            getSequencesForRequests(this.itemProvider, targetDirectory)
                .filter(
                    ({ path, sequence }) =>
                        path != newPath && sequence >= newSequence
                )
                .forEach(({ path, sequence: initialSequence }) => {
                    replaceSequenceForFile(path, initialSequence + 1);
                });
        }

        normalizeSequencesForRequestFiles(this.itemProvider, targetDirectory);
    }

    private duplicateFile(collection: Collection, item: BrunoTreeItem) {
        const originalPath = item.getPath();
        const newPath = getPathForDuplicatedItem(originalPath);

        copyFileSync(originalPath, newPath);

        if (getSequenceForFile(collection, originalPath)) {
            replaceSequenceForFile(
                newPath,
                getMaxSequenceForRequests(
                    this.itemProvider,
                    dirname(originalPath)
                ) + 1
            );
        }
    }

    private async showWarningDialog(modalMessage: string, detailText: string) {
        const picked = await vscode.window.showWarningMessage(
            modalMessage,
            {
                modal: true,
                detail: detailText,
            },
            this.confirmationOptionForModals
        );

        return picked == this.confirmationOptionForModals;
    }

    private handleChangedTextEditor(
        e: vscode.TextEditor | undefined,
        treeView: vscode.TreeView<BrunoTreeItem>
    ) {
        if (e && treeView.visible) {
            const maybeCollection =
                this.itemProvider.getAncestorCollectionForPath(
                    e.document.uri.fsPath
                );

            if (
                maybeCollection &&
                // Sometimes when e.g. renaming a folder, the descendant file paths may not have been updated in the collection yet.
                maybeCollection.getStoredDataForPath(e.document.uri.fsPath)
            ) {
                const treeItem = (
                    maybeCollection.getStoredDataForPath(
                        e.document.uri.fsPath
                    ) as CollectionData
                ).treeItem;

                this.logger?.debug(
                    `Starting first attempt of revealing item '${
                        treeItem.path
                    }' in explorer for collection '${basename(
                        maybeCollection.getRootDirectory()
                    )}'.`
                );

                treeView.reveal(treeItem).then(() => {
                    // Sometimes the 'reveal' command does not actually reveal the item, in that case it is retried once
                    if (
                        !treeView.selection.some(
                            (item) => item.getPath() == e.document.uri.fsPath
                        )
                    ) {
                        this.logger?.debug(
                            `Starting second attempt of revealing item '${
                                treeItem.path
                            }' in explorer for collection '${basename(
                                maybeCollection.getRootDirectory()
                            )}'.`
                        );

                        treeView.reveal(treeItem);
                    }
                });
            }
        }
    }

    private getTargetDirectoryForDragAndDrop(target: BrunoTreeItem) {
        return target.isFile ? dirname(target.getPath()) : target.getPath();
    }
}
