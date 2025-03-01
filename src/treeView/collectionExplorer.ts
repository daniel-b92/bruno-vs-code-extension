import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./treeItems/brunoTreeItemProvider";
import { FileChangedEvent } from "./shared/definitions";
import { BrunoTreeItem } from "./treeItems/brunoTreeItem";
import {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "fs";
import { dirname, extname, resolve } from "path";
import { getSequence } from "../shared/fileSystem/testFileParser";

export class CollectionExplorer {
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

        vscode.window.createTreeView("brunoCollections", {
            treeDataProvider,
        });

        vscode.commands.registerCommand("brunoCollections.refresh", () =>
            treeDataProvider.refresh()
        );

        vscode.commands.registerCommand(
            "brunoCollections.deleteItem",
            (item: BrunoTreeItem) => {
                const path = item.getPath();
                rmSync(path, { recursive: true, force: true });

                if (existsSync(dirname(path))) {
                    this.updateSequencesForRequestFiles(dirname(path));
                }
            }
        );
    }

    private updateSequencesForRequestFiles(parentDirectoryPath: string) {
        const initialSequences: { path: string; sequence: number }[] = [];

        readdirSync(parentDirectoryPath).map((childName) => {
            const fullPath = resolve(parentDirectoryPath, childName);

            if (
                lstatSync(fullPath).isFile() &&
                extname(fullPath) == ".bru" &&
                getSequence(fullPath) != undefined
            ) {
                initialSequences.push({
                    path: fullPath,
                    sequence: getSequence(fullPath) as number,
                });
            }
        });

        initialSequences.sort(
            ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2
        );

        for (let i = 0; i < initialSequences.length; i++) {
            const { path, sequence: initialSeq } = initialSequences[i];
            const newSeq = i + 1;

            if (initialSeq != newSeq) {
                writeFileSync(
                    path,
                    readFileSync(path)
                        .toString()
                        .replace(
                            new RegExp(`seq:\\s*${initialSeq}`),
                            `seq: ${newSeq}`
                        )
                );
            }
        }
    }
}
