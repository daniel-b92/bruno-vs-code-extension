import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    getSequenceFromMetaBlock,
    getSequencesForRequests,
    getMaxSequenceForRequests,
    CollectionItemProvider,
    RequestFileBlockName,
    parseBruFile,
    TextDocumentHelper,
    CollectionData,
    normalizeDirectoryPath,
    getExtensionForRequestFiles,
    addMetaBlock,
    appendDefaultMethodBlock,
    RequestType,
    MetaBlockKey,
    getFieldFromMetaBlock,
    OutputChannelLogger,
} from "../../shared";
import {
    copyFileSync,
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "fs";
import { basename, dirname, extname, resolve } from "path";
import { BrunoTreeItem } from "../brunoTreeItem";

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
                            return this.validateNewItemNameIsUnique(
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
                this.createRequestFile(item);
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
                            return this.validateNewItemNameIsUnique(
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
                            return this.validateNewItemNameIsUnique(
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

                        this.renameFileOrFolder(
                            originalPath,
                            newPath,
                            isFile
                        ).then((renamed) => {
                            if (
                                renamed &&
                                isFile &&
                                extname(newPath) ==
                                    getExtensionForRequestFiles()
                            ) {
                                this.replaceNameInRequestFile(newPath);
                            }
                        });
                    });
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFolder`,
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();

                cpSync(
                    item.getPath(),
                    this.getPathForDuplicatedItem(originalPath),
                    { recursive: true }
                );
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.duplicateFile`,
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();
                const newPath = this.getPathForDuplicatedItem(originalPath);

                copyFileSync(originalPath, newPath);

                if (
                    extname(originalPath) == getExtensionForRequestFiles() &&
                    getSequenceFromMetaBlock(originalPath) != undefined
                ) {
                    this.replaceSequenceForRequest(
                        newPath,
                        getMaxSequenceForRequests(dirname(originalPath)) + 1
                    );
                }
            }
        );

        vscode.commands.registerCommand(
            `${this.treeViewId}.deleteItem`,
            (item: BrunoTreeItem) => {
                const confirmationOption = "Confirm";

                vscode.window
                    .showInformationMessage(
                        `Delete '${item.label}'?`,
                        { modal: true },
                        confirmationOption
                    )
                    .then((picked) => {
                        if (picked != confirmationOption) {
                            return;
                        }
                        const path = item.getPath();

                        const workspaceEdit = new vscode.WorkspaceEdit();
                        workspaceEdit.deleteFile(
                            vscode.Uri.file(item.getPath()),
                            { recursive: true }
                        );

                        vscode.workspace
                            .applyEdit(workspaceEdit)
                            .then((deleted) => {
                                if (
                                    deleted &&
                                    extname(path) ==
                                        getExtensionForRequestFiles() &&
                                    existsSync(dirname(path))
                                ) {
                                    this.normalizeSequencesForRequestFiles(
                                        dirname(path)
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

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((e) => {
                if (e && treeView.visible) {
                    const maybeCollection =
                        this.itemProvider.getAncestorCollectionForPath(
                            e.document.uri.fsPath
                        );

                    if (
                        maybeCollection &&
                        // Sometimes when e.g. renaming a folder, the descendant file paths may not have been updated in the collection yet.
                        maybeCollection.getStoredDataForPath(
                            e.document.uri.fsPath
                        )
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
                                    (item) =>
                                        item.getPath() == e.document.uri.fsPath
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
            })
        );
    }

    private disposables: vscode.Disposable[] = [];

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

        this.renameFileOrFolder(sourcePath, newPath, isFile).then((renamed) => {
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

    private async createRequestFile(item: BrunoTreeItem) {
        const parentFolderPath = item.getPath();

        const requestName = await vscode.window.showInputBox({
            title: `Create request file in '${basename(parentFolderPath)}'`,
            value: "request_name",
            validateInput: (newFileName: string) => {
                return this.validateNewItemNameIsUnique(
                    resolve(
                        parentFolderPath,
                        `${newFileName}${getExtensionForRequestFiles()}`
                    )
                );
            },
        });

        if (requestName == undefined) {
            return;
        }

        const pickedLabels: string[] = [];

        const quickPick = vscode.window.createQuickPick();

        quickPick.totalSteps = 2;
        quickPick.step = 1;
        quickPick.title = "Select the request type";
        quickPick.items = Object.values(RequestType).map((type) => ({
            label: type,
        }));

        quickPick.onDidChangeSelection((picks) => {
            pickedLabels.push(...picks.map(({ label }) => label));

            if (pickedLabels.length == 1) {
                quickPick.hide();

                quickPick.step = 2;
                quickPick.title = "Select the method";
                quickPick.items = [
                    { label: RequestFileBlockName.Put },
                    { label: RequestFileBlockName.Post },
                    { label: RequestFileBlockName.Get },
                    { label: RequestFileBlockName.Patch },
                    { label: RequestFileBlockName.Options },
                    { label: RequestFileBlockName.Head },
                ];

                quickPick.show();
                return;
            }

            quickPick.dispose();

            const filePath = resolve(
                parentFolderPath,
                `${requestName}${getExtensionForRequestFiles()}`
            );
            writeFileSync(filePath, "");

            const collectionForFile =
                this.itemProvider.getAncestorCollectionForPath(filePath);

            if (!collectionForFile) {
                throw new Error(
                    `No registered collection found for newly created request file '${filePath}'`
                );
            }
            if (pickedLabels.length != 2) {
                throw new Error(
                    `Did not find as many picked items as expected. Expected to get 2. Instead got '${JSON.stringify(
                        pickedLabels,
                        null,
                        2
                    )}'`
                );
            }

            addMetaBlock(
                collectionForFile,
                filePath,
                pickedLabels[0] as RequestType
            );

            appendDefaultMethodBlock(
                filePath,
                pickedLabels[1] as RequestFileBlockName
            );

            vscode.commands.executeCommand(
                "vscode.open",
                vscode.Uri.file(filePath)
            );
        });

        quickPick.show();
    }

    private replaceNameInRequestFile(filePath: string) {
        const documentHelper = new TextDocumentHelper(
            readFileSync(filePath).toString()
        );

        const metaBlock = parseBruFile(documentHelper).blocks.find(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlock) {
            const nameField = getFieldFromMetaBlock(
                metaBlock,
                MetaBlockKey.Name
            );

            const newName =
                extname(filePath).length > 0
                    ? basename(filePath).substring(
                          0,
                          basename(filePath).indexOf(
                              extname(basename(filePath))
                          )
                      )
                    : basename(filePath);

            if (nameField) {
                writeFileSync(
                    filePath,
                    documentHelper.getFullTextWithReplacement(
                        {
                            lineIndex: nameField.valueRange.start.line,
                            startCharIndex:
                                nameField.valueRange.start.character,
                            endCharIndex: nameField.valueRange.end.character,
                        },
                        newName
                    )
                );
            }
        }
    }

    private validateNewItemNameIsUnique(
        newItemPath: string,
        originalItemPath?: string
    ) {
        return existsSync(newItemPath) &&
            (!originalItemPath || newItemPath != originalItemPath)
            ? `${
                  lstatSync(newItemPath).isFile() ? "File" : "Folder"
              } with name '${basename(newItemPath)}' already exists`
            : undefined;
    }

    private getPathForDuplicatedItem(originalPath: string) {
        const getBasePathForNewItem = (path: string, toAppend: string) =>
            lstatSync(path).isDirectory()
                ? `${path}${toAppend}`
                : path.replace(
                      basename(path),
                      `${basename(path).replace(
                          extname(path),
                          ""
                      )}${toAppend}${extname(path)}`
                  );

        const maxAttempts = 100;
        const basePath = getBasePathForNewItem(originalPath, "_Copy");
        let newPath = basePath;
        let attempts = 1;

        while (existsSync(newPath) && attempts < maxAttempts) {
            newPath = getBasePathForNewItem(basePath, attempts.toString());
            attempts++;
        }

        if (existsSync(newPath)) {
            throw new Error(
                `Did not manage to find new path for item path '${originalPath}' to duplicate within ${maxAttempts} attempts!`
            );
        }
        return newPath;
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
                : getMaxSequenceForRequests(targetDirectory) + 1
            : getMaxSequenceForRequests(targetDirectory) + 1;

        this.replaceSequenceForRequest(newPath, newSequence);

        if (target.isFile) {
            getSequencesForRequests(targetDirectory)
                .filter(
                    ({ path, sequence }) =>
                        path != newPath && sequence >= newSequence
                )
                .forEach(({ path, sequence: initialSequence }) => {
                    this.replaceSequenceForRequest(path, initialSequence + 1);
                });
        }

        this.normalizeSequencesForRequestFiles(targetDirectory);
    }

    private async renameFileOrFolder(
        sourcePath: string,
        targetPath: string,
        isFile: boolean
    ) {
        const workspaceEdit = new vscode.WorkspaceEdit();

        workspaceEdit.renameFile(
            vscode.Uri.file(sourcePath),
            vscode.Uri.file(targetPath)
        );

        const renamedSuccessfully = await vscode.workspace.applyEdit(
            workspaceEdit
        );

        if (renamedSuccessfully) {
            return true;
        } else {
            vscode.window.showErrorMessage(
                `Renaming / Moving ${
                    isFile ? "file" : "folder"
                } '${sourcePath}' failed unexpectedly.`
            );

            return false;
        }
    }

    private getTargetDirectoryForDragAndDrop(target: BrunoTreeItem) {
        return target.isFile ? dirname(target.getPath()) : target.getPath();
    }

    private normalizeSequencesForRequestFiles(parentDirectoryPath: string) {
        const initialSequences = getSequencesForRequests(parentDirectoryPath);

        initialSequences.sort(
            ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2
        );

        for (let i = 0; i < initialSequences.length; i++) {
            const { path, sequence: initialSeq } = initialSequences[i];
            const newSeq = i + 1;

            if (initialSeq != newSeq) {
                this.replaceSequenceForRequest(path, newSeq);
            }
        }
    }

    private replaceSequenceForRequest(filePath: string, newSequence: number) {
        const originalSequence = getSequenceFromMetaBlock(filePath);

        if (originalSequence != undefined) {
            writeFileSync(
                filePath,
                readFileSync(filePath)
                    .toString()
                    .replace(
                        new RegExp(`seq:\\s*${originalSequence}`),
                        `seq: ${newSequence}`
                    )
            );
        }
    }
}
