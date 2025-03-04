import { lstatSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import * as vscode from "vscode";
import { getAllCollectionRootDirectories } from "../../shared/fileSystem/collectionRootFolderHelper";
import { getSequence } from "../../shared/fileSystem/testFileParser";
import { BrunoTreeItem } from "./brunoTreeItem";
import { TreeItemRegistry } from "./treeItemRegistry";
import { FileChangedEvent, FileChangeType } from "../shared/definitions";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>
{
    constructor(
        private workspaceRoot: string,
        fileChangedEmitter: vscode.EventEmitter<FileChangedEvent>
    ) {
        this.itemRegistry = new TreeItemRegistry(fileChangedEmitter);
        fileChangedEmitter.event(({ uri, changeType }) => {
            const maybeRegisteredItem = this.itemRegistry.getItem(uri.fsPath);

            if (
                maybeRegisteredItem &&
                (changeType == FileChangeType.Deleted ||
                    (changeType == FileChangeType.Modified &&
                        maybeRegisteredItem.getSequence() !=
                            getSequence(uri.fsPath)))
            ) {
                this.itemRegistry.unregisterItem(uri.fsPath);
                this.itemRegistry.unregisterAllDescendants(uri.fsPath);

                const maybeParent = this.tryToFindRegisteredParentItem(
                    maybeRegisteredItem.getPath()
                );

                if (maybeParent) {
                    this._onDidChangeTreeData.fire(maybeParent);
                } else {
                    // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
                    this._onDidChangeTreeData.fire(undefined);
                }
            } else if (
                !maybeRegisteredItem &&
                changeType == FileChangeType.Created
            ) {
                const maybeParentItem = this.tryToFindRegisteredParentItem(
                    uri.fsPath
                );

                if (maybeParentItem) {
                    this._onDidChangeTreeData.fire(maybeParentItem);
                } else {
                    // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
                    this._onDidChangeTreeData.fire(undefined);
                }
            }
        });
    }

    private itemRegistry: TreeItemRegistry;

    async getTreeItem(element: BrunoTreeItem): Promise<vscode.TreeItem> {
        if (!this.itemRegistry.getItem(element.getPath())) {
            await this.itemRegistry.registerItem(element);
        }
        return element as unknown as vscode.TreeItem;
    }

    async getParent(element: BrunoTreeItem) {
        return this.itemRegistry.getItem(dirname(element.getPath()));
    }

    public refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    async getChildren(element?: BrunoTreeItem): Promise<BrunoTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(
                "No Bruno test data found in empty workspace"
            );
            return Promise.resolve([]);
        }

        if (!element) {
            return (
                await Promise.all(
                    (
                        await getAllCollectionRootDirectories()
                    ).map(async (path) => {
                        const collectionItem = new BrunoTreeItem(path, false);

                        if (
                            !this.itemRegistry.getItem(collectionItem.getPath())
                        ) {
                            await this.itemRegistry.registerItem(
                                collectionItem
                            );
                        }

                        return collectionItem;
                    })
                )
            ).sort((a, b) =>
                (a.label as string) > (b.label as string) ? 1 : -1
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

    private _onDidChangeTreeData: vscode.EventEmitter<
        BrunoTreeItem | undefined
    > = new vscode.EventEmitter<BrunoTreeItem>();
    readonly onDidChangeTreeData: vscode.Event<BrunoTreeItem | undefined> =
        this._onDidChangeTreeData.event;

    private tryToFindRegisteredParentItem(path: string) {
        return this.itemRegistry.getItem(dirname(path));
    }
}
