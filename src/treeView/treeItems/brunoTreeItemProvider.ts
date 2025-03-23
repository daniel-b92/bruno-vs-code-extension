import { lstatSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import * as vscode from "vscode";
import { getSequence } from "../../shared/fileSystem/testFileParsing/testFileParser";
import { BrunoTreeItem } from "./brunoTreeItem";
import { CollectionItemProvider } from "../../shared/state/collectionItemProvider";
import { CollectionItem } from "../../shared/state/model/collectionItemInterface";
import { CollectionFile } from "../../shared/state/model/collectionFile";
import { FileChangeType } from "../../shared/fileSystem/fileChangesDefinitions";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>
{
    constructor(
        private workspaceRoot: string,
        private collectionItemProvider: CollectionItemProvider
    ) {
        collectionItemProvider
            .subscribeToUpdates()
            .event(({ collection, item, updateType, changedData }) => {
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
                    const maybeParentItem =
                        collectionItemProvider.getRegisteredItem(
                            collection,
                            dirname(item.getPath())
                        );

                    if (maybeParentItem) {
                        this._onDidChangeTreeData.fire(
                            this.mapCollectionItemToTreeItem(maybeParentItem)
                        );
                    } else {
                        // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
                        this._onDidChangeTreeData.fire(undefined);
                    }
                }
            });
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

        return registeredParent
            ? this.mapCollectionItemToTreeItem(registeredParent)
            : undefined;
    }

    public refresh() {
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
                .map((collection) =>
                    this.mapCollectionItemToTreeItem(
                        collection.getTestItemForPath(
                            collection.getRootDirectory()
                        ) as CollectionItem
                    )
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

                    const maybeRegisteredItem = maybeCollection
                        ? this.collectionItemProvider.getRegisteredItem(
                              maybeCollection,
                              fullPath
                          )
                        : undefined;

                    if (maybeRegisteredItem) {
                        return this.mapCollectionItemToTreeItem(
                            maybeRegisteredItem
                        );
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

    private mapCollectionItemToTreeItem(item: CollectionItem) {
        const isFile = item instanceof CollectionFile;

        return new BrunoTreeItem(
            item.getPath(),
            isFile,
            isFile ? item.getSequence() : undefined
        );
    }

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
