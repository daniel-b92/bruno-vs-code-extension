import * as vscode from "vscode";
import { BrunoTreeItemProvider } from "./treeItems/brunoTreeItemProvider";
import { FileChangedEvent } from "./shared/definitions";
import { BrunoTreeItem } from "./treeItems/brunoTreeItem";
import { rmSync } from "fs";

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
                rmSync(item.getPath(), { recursive: true, force: true });
            }
        );
    }
}
