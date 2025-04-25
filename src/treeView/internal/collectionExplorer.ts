import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    getSequence,
    getSequencesForRequests,
    getMaxSequenceForRequests,
    CollectionItemProvider,
    RequestFileBlockName,
    parseTestFile,
    TextDocumentHelper,
    CollectionData,
    normalizeDirectoryPath,
    getExtensionForRequestFiles,
    addMetaBlock,
    appendDefaultMethodBlock,
    RequestType,
    MetaBlockKey,
} from "../../shared";
import {
    copyFileSync,
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
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
        extensionContext: vscode.ExtensionContext,
        private itemProvider: CollectionItemProvider,
        startTestRunEmitter: vscode.EventEmitter<vscode.Uri>
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
            itemProvider
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
                        title: `Rename '${basename(originalPath)}'`,
                        value: basename(originalPath),
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

                        renameSync(originalPath, newPath);

                        if (
                            isFile &&
                            extname(newPath) == getExtensionForRequestFiles()
                        ) {
                            this.replaceNameInRequestFile(newPath);
                        }

                        this.updateTabsAfterChangingItemPath(
                            originalPath,
                            newPath,
                            isFile
                        );
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
                    getSequence(originalPath) != undefined
                ) {
                    replaceSequenceForRequest(
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
                        return new Promise<void>((resolve) => {
                            if (picked != confirmationOption) {
                                resolve();
                            }

                            const path = item.getPath();
                            rmSync(path, { recursive: true, force: true });

                            if (
                                extname(path) ==
                                    getExtensionForRequestFiles() &&
                                existsSync(dirname(path))
                            ) {
                                this.normalizeSequencesForRequestFiles(
                                    dirname(path)
                                );
                            }

                            vscode.window.tabGroups
                                .close(
                                    this.getOpenTabsStartingWithPath(
                                        item.isFile
                                            ? item.getPath()
                                            : normalizeDirectoryPath(
                                                  item.getPath()
                                              )
                                    ).map(({ tab }) => tab)
                                )
                                .then(() => resolve());
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

        extensionContext.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((e) => {
                if (e && treeView.visible) {
                    const maybeCollection =
                        this.itemProvider.getAncestorCollectionForPath(
                            e.document.uri.fsPath
                        );

                    if (maybeCollection) {
                        treeView.reveal(
                            (
                                maybeCollection.getStoredDataForPath(
                                    e.document.uri.fsPath
                                ) as CollectionData
                            ).treeItem
                        );
                    }
                }
            })
        );
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

        if (isFile) {
            renameSync(sourcePath, newPath);

            // Only when moving a file, sequences of requests may need to be adjusted
            this.updateSequencesAfterMovingFile(target, sourcePath);
        } else {
            cpSync(sourcePath, newPath, { recursive: true });
            rmSync(sourcePath, { recursive: true, force: true });
        }

        this.updateTabsAfterChangingItemPath(sourcePath, newPath, isFile);
    }

    private async createRequestFile(item: BrunoTreeItem) {
        const parentFolderPath = item.getPath();

        const requestName = await vscode.window.showInputBox({
            title: `Create request file in '${basename(parentFolderPath)}'`,
            value: "request_name",
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

        const metaBlock = parseTestFile(documentHelper).blocks.find(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlock && Array.isArray(metaBlock.content)) {
            const nameField = metaBlock.content.find(
                ({ key }) => key == MetaBlockKey.Name
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

    private updateTabsAfterChangingItemPath(
        originalPath: string,
        newPath: string,
        isFile: boolean
    ) {
        const toClose = this.getOpenTabsStartingWithPath(
            isFile ? originalPath : normalizeDirectoryPath(originalPath)
        );

        const toOpenInstead = toClose.map(({ tab, filePath }) => ({
            viewColumn: tab.group.viewColumn,
            filePath: isFile ? newPath : resolve(newPath, basename(filePath)),
        }));

        vscode.window.tabGroups
            .close(toClose.map(({ tab }) => tab))
            .then(() => {
                for (const { filePath, viewColumn } of toOpenInstead) {
                    vscode.workspace
                        .openTextDocument(filePath)
                        .then((document) => {
                            vscode.window.showTextDocument(
                                document,
                                viewColumn
                            );
                        });
                }
            });
    }

    private getOpenTabsStartingWithPath(path: string) {
        return vscode.window.tabGroups.all
            .map(({ tabs }) => tabs)
            .flat()
            .filter(
                (tab) =>
                    tab.input instanceof vscode.TabInputText &&
                    tab.input.uri.fsPath.startsWith(path)
            )
            .map((tab) => ({
                tab,
                filePath: (tab.input as vscode.TabInputText).uri.fsPath,
            }));
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

        replaceSequenceForRequest(newPath, newSequence);

        if (target.isFile) {
            getSequencesForRequests(targetDirectory)
                .filter(
                    ({ path, sequence }) =>
                        path != newPath && sequence >= newSequence
                )
                .forEach(({ path, sequence: initialSequence }) => {
                    replaceSequenceForRequest(path, initialSequence + 1);
                });
        }

        this.normalizeSequencesForRequestFiles(targetDirectory);
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
                replaceSequenceForRequest(path, newSeq);
            }
        }
    }
}

const replaceSequenceForRequest = (filePath: string, newSequence: number) => {
    const originalSequence = getSequence(filePath);

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
};
