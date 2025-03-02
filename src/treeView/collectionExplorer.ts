import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./treeItems/brunoTreeItemProvider";
import { FileChangedEvent } from "./shared/definitions";
import { BrunoTreeItem } from "./treeItems/brunoTreeItem";
import {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "fs";
import { basename, dirname, extname, resolve } from "path";
import { getSequence } from "../shared/fileSystem/testFileParser";

export class CollectionExplorer
    implements vscode.TreeDragAndDropController<BrunoTreeItem>
{
    dragMimeTypes = ["text/uri-list"];
    dropMimeTypes = ["application/vnd.code.tree.brunocollectionsview"];

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
        const item = dataTransfer.get(
            "text/uri-list"
        ) as vscode.DataTransferItem;
        const sourcePath = await item.asString();

        if (!target || !existsSync(target.getPath())) {
            return;
        }

        if (lstatSync(target.getPath()).isFile()) {
            const targetDirectory = dirname(target.getPath());

            const newPath = resolve(targetDirectory, basename(sourcePath));
            renameSync(sourcePath, newPath);

            const newSequence = target.getSequence()
                ? (target.getSequence() as number) + 1
                : this.getMaxSequenceForRequests(targetDirectory) + 1;
            replaceSequenceForRequest(newPath, newSequence);

            getExistingSequencesForRequests(targetDirectory)
                .filter(
                    ({ path, sequence }) =>
                        path != newPath && sequence >= newSequence
                )
                .forEach(({ path, sequence: initialSequence }) => {
                    replaceSequenceForRequest(path, initialSequence + 1);
                });
        } else {
            // In this case the target is a directory
            const targetDirectory = target.getPath();

            const newPath = resolve(targetDirectory, basename(sourcePath));
            renameSync(sourcePath, newPath);

            replaceSequenceForRequest(
                newPath,
                this.getMaxSequenceForRequests(targetDirectory) + 1
            );
        }
    }

    constructor(fileChangedEmitter: vscode.EventEmitter<FileChangedEvent>) {
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
            fileChangedEmitter
        );

        vscode.window.createTreeView("brunoCollectionsView", {
            treeDataProvider,
            dragAndDropController: this,
        });

        vscode.commands.registerCommand("brunoCollectionsView.refresh", () =>
            treeDataProvider.refresh()
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.duplicateFile",
            (item: BrunoTreeItem) => {
                const originalPath = item.getPath();
                const newPath = this.getPathForDuplicatedFile(originalPath);
                const originalContent = readFileSync(originalPath);

                if (
                    extname(originalPath) == ".bru" &&
                    getSequence(originalPath) != undefined
                ) {
                    writeFileSync(newPath, originalContent);
                    replaceSequenceForRequest(
                        newPath,
                        this.getMaxSequenceForRequests(dirname(originalPath)) +
                            1
                    );
                } else {
                    writeFileSync(
                        this.getPathForDuplicatedFile(originalPath),
                        originalContent
                    );
                }
            }
        );

        vscode.commands.registerCommand(
            "brunoCollectionsView.deleteItem",
            (item: BrunoTreeItem) => {
                const path = item.getPath();
                rmSync(path, { recursive: true, force: true });

                if (extname(path) == ".bru" && existsSync(dirname(path))) {
                    this.updateSequencesForRequestFiles(dirname(path));
                }
            }
        );
    }

    private getMaxSequenceForRequests(directory: string) {
        return Math.max(
            ...getExistingSequencesForRequests(directory).map(
                ({ sequence }) => sequence
            )
        );
    }

    private getPathForDuplicatedFile(originalFile: string) {
        const appendToFileName = (path: string, toAppend: string) =>
            path.replace(
                basename(path),
                `${basename(path).replace(
                    extname(path),
                    ""
                )}${toAppend}${extname(path)}`
            );

        const maxAttempts = 100;
        const basePath = appendToFileName(originalFile, "_Copy");
        let newPath = basePath;
        let attempts = 1;

        while (existsSync(newPath) && attempts < maxAttempts) {
            newPath = appendToFileName(basePath, attempts.toString());
            attempts++;
        }

        if (existsSync(newPath)) {
            throw new Error(
                `Did not manage to find new path for duplicated file withtin ${maxAttempts} attempts!`
            );
        }
        return newPath;
    }

    private updateSequencesForRequestFiles(parentDirectoryPath: string) {
        const initialSequences =
            getExistingSequencesForRequests(parentDirectoryPath);

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

const getExistingSequencesForRequests = (directory: string) => {
    const result: { path: string; sequence: number }[] = [];

    readdirSync(directory).map((childName) => {
        const fullPath = resolve(directory, childName);

        if (
            lstatSync(fullPath).isFile() &&
            extname(fullPath) == ".bru" &&
            getSequence(fullPath) != undefined
        ) {
            result.push({
                path: fullPath,
                sequence: getSequence(fullPath) as number,
            });
        }
    });

    return result;
};
