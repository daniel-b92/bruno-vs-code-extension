import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import {
    BrunoTreeItem,
    getSequence,
    getSequencesForRequests,
    getMaxSequenceForRequests,
    CollectionItemProvider,
    normalizeDirectoryPath,
    RequestFileBlockName,
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
import { addMetaBlock } from "../../shared/fileSystem/testFileWriting/addMetaBlock";
import { appendDefaultMethodBlock } from "../../shared/fileSystem/testFileWriting/appendDefaultMethodBlock";
import { RequestType } from "../../shared/fileSystem/testFileWriting/internal/requestTypeEnum";

export class CollectionExplorer
    implements vscode.TreeDragAndDropController<BrunoTreeItem>
{
    dragMimeTypes = ["text/uri-list"];
    dropMimeTypes = ["application/vnd.code.tree.brunocollectionsview"];

    constructor(
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

        vscode.window.createTreeView("brunoCollectionsView", {
            treeDataProvider,
            dragAndDropController: this,
        });

        vscode.commands.registerCommand("brunoCollectionsView.refresh", () => {
            treeDataProvider.refresh();
        });

        vscode.commands.registerCommand(
            "brunoCollectionsView.createEmptyFile",
            async (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                const fileName = await vscode.window.showInputBox({
                    title: `Create file in '${basename(parentFolderPath)}'`,
                });

                if (fileName == undefined) {
                    return;
                }

                const filePath = resolve(parentFolderPath, fileName);
                writeFileSync(filePath, "");

                vscode.commands.executeCommand(
                    "vscode.open",
                    vscode.Uri.file(filePath)
                );

                // ToDo: Reveal file in collection explorer after it has been added to tree
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.createRequestFile",
            async (item: BrunoTreeItem) => {
                this.createRequestFile(item);
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.createFolder",
            async (item: BrunoTreeItem) => {
                const parentFolderPath = item.getPath();

                const folderName = await vscode.window.showInputBox({
                    title: `Create folder in '${basename(parentFolderPath)}'`,
                });

                if (folderName == undefined) {
                    return;
                }

                mkdirSync(resolve(parentFolderPath, folderName));
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.renameItem",
            async (item: BrunoTreeItem) => {
                const originalPath = item.getPath();
                const originalName = basename(originalPath);

                const newName = await vscode.window.showInputBox({
                    title: `Rename '${originalName}'`,
                    value: originalName,
                    valueSelection: [
                        0,
                        originalName.includes(".")
                            ? originalName.indexOf(".")
                            : originalName.length,
                    ],
                });

                if (newName == undefined) {
                    return;
                }

                renameSync(
                    originalPath,
                    resolve(dirname(originalPath), newName)
                );

                this.closeOpenTabsForPath(item.getPath());
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.duplicateFolder",
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
            "brunoCollectionsView.duplicateFile",
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();
                const newPath = this.getPathForDuplicatedItem(originalPath);

                copyFileSync(originalPath, newPath);

                if (
                    extname(originalPath) == ".bru" &&
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
            "brunoCollectionsView.deleteItem",
            async (item: BrunoTreeItem) => {
                const confirmationOption = "Confirm";

                const picked = await vscode.window.showInformationMessage(
                    `Delete '${item.label}'?`,
                    { modal: true },
                    confirmationOption
                );

                if (picked == confirmationOption) {
                    const path = item.getPath();
                    rmSync(path, { recursive: true, force: true });

                    if (extname(path) == ".bru" && existsSync(dirname(path))) {
                        this.normalizeSequencesForRequestFiles(dirname(path));
                    }

                    this.closeOpenTabsForPath(item.getPath());
                }
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.startTestRun",
            (item: BrunoTreeItem) => {
                startTestRunEmitter.fire(vscode.Uri.file(item.getPath()));
            }
        );
    }

    handleDrag(
        source: readonly BrunoTreeItem[],
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ) {
        dataTransfer.set("text/uri-list", {
            async asString() {
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

        const targetIsFile = lstatSync(target.getPath()).isFile();
        const targetDirectory = targetIsFile
            ? dirname(target.getPath())
            : target.getPath();

        const sourcePath = await item.asString();
        const newPath = resolve(targetDirectory, basename(sourcePath));
        renameSync(sourcePath, newPath);

        if (!(item.value as BrunoTreeItem).isFile) {
            // When moving a directory, no sequences of requests need to be adjusted
            return;
        }

        const newSequence = targetIsFile
            ? target.getSequence()
                ? (target.getSequence() as number) + 1
                : getMaxSequenceForRequests(targetDirectory) + 1
            : getMaxSequenceForRequests(targetDirectory) + 1;

        replaceSequenceForRequest(newPath, newSequence);

        if (targetIsFile) {
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

            const filePath = resolve(parentFolderPath, `${requestName}.bru`);
            writeFileSync(filePath, "");

            const collectionForFile = this.itemProvider
                .getRegisteredCollections()
                .find((collection) =>
                    filePath.startsWith(
                        normalizeDirectoryPath(collection.getRootDirectory())
                    )
                );

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
            // ToDo: Reveal file in collection explorer after it has been added to tree
        });

        quickPick.show();
    }

    private closeOpenTabsForPath(path: string) {
        const tabsToClose = vscode.window.tabGroups.all
            .map(({ tabs }) => tabs)
            .flat()
            .filter(
                (tab) =>
                    tab.input instanceof vscode.TabInputText &&
                    tab.input.uri.fsPath == path
            );

        for (const tab of tabsToClose) {
            vscode.window.tabGroups.close(tab);
        }
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
