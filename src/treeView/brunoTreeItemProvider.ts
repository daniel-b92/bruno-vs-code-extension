import { lstatSync, readdirSync } from "fs";
import { basename, resolve } from "path";
import * as vscode from "vscode";
import { getAllCollectionRootDirectories } from "../shared/fileSystem/collectionRootFolderHelper";
import { getSequence } from "../shared/fileSystem/testFileParser";
import { BrunoTreeItem } from "./brunoTreeItem";
import { BrunoTestItemRegistry } from "./brunoTestItemRegistry";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>
{
    constructor(
        private workspaceRoot: string,
        fileChangedEmitter: vscode.EventEmitter<vscode.Uri>
    ) {
        this.itemRegistry = new BrunoTestItemRegistry(fileChangedEmitter);
        fileChangedEmitter.event((uri) => {
            const maybeRegisteredItem = this.itemRegistry.getItem(uri.fsPath);

            if (
                !maybeRegisteredItem ||
                (maybeRegisteredItem &&
                    maybeRegisteredItem.getSequence() !=
                        getSequence(uri.fsPath))
            ) {
                // If the changed item is a bruno request file with a sequence we need to update all items in the same folder.
                // Otherwise the sequences may not be up to date anymore.
                this._onDidChangeTreeData.fire(
                    this.itemRegistry.getItem(
                        basename(uri.fsPath)
                    ) as BrunoTreeItem
                );
            }
        });
    }

    private itemRegistry: BrunoTestItemRegistry;

    async getTreeItem(element: BrunoTreeItem): Promise<vscode.TreeItem> {
        if (!this.itemRegistry.getItem(element.getPath())) {
            await this.itemRegistry.registerItem(element);
        }
        return element as unknown as vscode.TreeItem;
    }

    async getChildren(element?: BrunoTreeItem): Promise<BrunoTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(
                "No Bruno test data found in empty workspace"
            );
            return Promise.resolve([]);
        }

        if (!element) {
            return await Promise.all(
                (
                    await getAllCollectionRootDirectories()
                ).map(async (path) => {
                    const collectionItem = new BrunoTreeItem(path, false);

                    if (!this.itemRegistry.getItem(collectionItem.getPath())) {
                        await this.itemRegistry.registerItem(collectionItem);
                    }

                    return collectionItem;
                })
            );
        } else {
            return Promise.resolve(
                (
                    await Promise.all(
                        readdirSync(element.path).map(async (childPath) => {
                            const fullPath = resolve(element.path, childPath);
                            const maybeRegisteredItem =
                                this.itemRegistry.getItem(fullPath);

                            if (
                                maybeRegisteredItem &&
                                maybeRegisteredItem.getSequence() ==
                                    getSequence(fullPath)
                            ) {
                                return maybeRegisteredItem;
                            } else if (maybeRegisteredItem) {
                                // Case where only the sequence of an existing request file was changed.
                                this.itemRegistry.unregisterItem(fullPath);
                            }

                            const item = lstatSync(fullPath).isFile()
                                ? new BrunoTreeItem(
                                      fullPath,
                                      true,
                                      getSequence(fullPath)
                                  )
                                : new BrunoTreeItem(fullPath, false);

                            await this.itemRegistry.registerItem(item);
                            return item;
                        })
                    )
                ).sort((a, b) =>
                    a.getSequence() != undefined && b.getSequence() != undefined
                        ? (a.getSequence() as number) -
                          (b.getSequence() as number)
                        : 0
                )
            );
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<BrunoTreeItem> =
        new vscode.EventEmitter<BrunoTreeItem>();
    readonly onDidChangeTreeData: vscode.Event<BrunoTreeItem> =
        this._onDidChangeTreeData.event;
}
