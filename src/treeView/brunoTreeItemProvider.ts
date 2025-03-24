import { lstatSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import * as vscode from "vscode";
import { getSequence } from "../shared/fileSystem/testFileParsing/testFileParser";
import { BrunoTreeItem } from "../shared/state/model/brunoTreeItem";
import { CollectionItemProvider } from "../shared/state/collectionItemProvider";
import { CollectionData } from "../shared/state/model/interfaces";
import { FileChangeType } from "../shared/fileSystem/fileChangesDefinitions";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>
{
    constructor(
        private workspaceRoot: string,
        private collectionItemProvider: CollectionItemProvider
    ) {
        collectionItemProvider.subscribeToUpdates()(
            ({ collection, data: { item }, updateType, changedData }) => {
                if (
                    updateType == FileChangeType.Deleted ||
                    (updateType == FileChangeType.Modified &&
                        changedData &&
                        changedData.sequence != undefined)
                ) {
                    // Always update all items when items have to be deleted from tree view.
                    // When only triggering an update for the parent item, there were issues with the refresh mechanism.
                    this._onDidChangeTreeData.fire(undefined);
                } else if (updateType == FileChangeType.Created) {
                    // Registration of the new item occurs in the `getTreeItem` or `getChildren` function
                    const maybeParent =
                        collectionItemProvider.getRegisteredItem(
                            collection,
                            dirname(item.getPath())
                        );

                    if (maybeParent) {
                        this._onDidChangeTreeData.fire(maybeParent.treeItem);
                    } else {
                        // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
                        this._onDidChangeTreeData.fire(undefined);
                    }
                }
            }
        );
    }

    async getTreeItem(element: BrunoTreeItem): Promise<vscode.TreeItem> {
        return element as unknown as vscode.TreeItem;
    }

    getParent(element: BrunoTreeItem) {
        const { collection } = this.mapTreeItemToCollectionItem(element);

        const registeredParent = this.collectionItemProvider.getRegisteredItem(
            collection,
            dirname(element.getPath())
        );

        return registeredParent ? registeredParent.treeItem : undefined;
    }

    public async refresh() {
        await this.collectionItemProvider.registerAllCollectionsAndTheirItems();
        this._onDidChangeTreeData.fire(undefined);
    }

    getChildren(element?: BrunoTreeItem): BrunoTreeItem[] {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(
                "No Bruno test data found in empty workspace"
            );
            return [];
        }

        if (!element) {
            return this.collectionItemProvider
                .getRegisteredCollections()
                .map(
                    (collection) =>
                        (
                            collection.getStoredDataForPath(
                                collection.getRootDirectory()
                            ) as CollectionData
                        ).treeItem
                )
                .sort((a, b) =>
                    (a.label as string) > (b.label as string) ? 1 : -1
                );
        } else {
            return readdirSync(element.path)
                .map((childPath) => {
                    const fullPath = resolve(element.path, childPath);
                    const maybeCollection =
                        this.collectionItemProvider.getRegisteredCollectionForItem(
                            fullPath
                        );

                    const maybeRegisteredData = maybeCollection
                        ? this.collectionItemProvider.getRegisteredItem(
                              maybeCollection,
                              fullPath
                          )
                        : undefined;

                    if (maybeRegisteredData) {
                        return maybeRegisteredData.treeItem;
                    }

                    const item = lstatSync(fullPath).isFile()
                        ? new BrunoTreeItem(
                              fullPath,
                              true,
                              getSequence(fullPath)
                          )
                        : new BrunoTreeItem(fullPath, false);

                    return item;
                })
                .sort((a, b) =>
                    a.getSequence() != undefined && b.getSequence() != undefined
                        ? (a.getSequence() as number) -
                          (b.getSequence() as number)
                        : 0
                );
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<
        BrunoTreeItem | undefined
    > = new vscode.EventEmitter<BrunoTreeItem>();
    readonly onDidChangeTreeData: vscode.Event<BrunoTreeItem | undefined> =
        this._onDidChangeTreeData.event;

    private mapTreeItemToCollectionItem(item: BrunoTreeItem) {
        const collection =
            this.collectionItemProvider.getRegisteredCollectionForItem(
                item.getPath()
            );

        if (!collection) {
            throw new Error(
                `No registered collection found for tree item with path '${item.getPath()}'.`
            );
        }

        return {
            collection,
            item: this.collectionItemProvider.getRegisteredItem(
                collection,
                item.getPath()
            ),
        };
    }
}
