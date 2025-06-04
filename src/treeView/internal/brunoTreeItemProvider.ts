import { dirname } from "path";
import * as vscode from "vscode";
import {
    getSequenceFromMetaBlock,
    CollectionData,
    FileChangeType,
    CollectionItemProvider,
    normalizeDirectoryPath,
    CollectionFile,
} from "../../shared";
import { BrunoTreeItem } from "../brunoTreeItem";

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
                        changedData?.sequenceChanged)
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

    getTreeItem(element: BrunoTreeItem): vscode.TreeItem {
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

    public refresh() {
        return new Promise<void>((resolve) => {
            this.collectionItemProvider.refreshCache().then(() => {
                this._onDidChangeTreeData.fire(undefined);
                resolve();
            });
        });
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
            const collection =
                this.collectionItemProvider.getAncestorCollectionForPath(
                    element.getPath()
                );

            if (!collection) {
                return [];
            }

            return collection
                .getAllStoredDataForCollection()
                .filter(
                    ({ item: registeredItem }) =>
                        normalizeDirectoryPath(
                            dirname(registeredItem.getPath())
                        ) == normalizeDirectoryPath(element.getPath())
                )
                .map(({ item: collectionItem }) => {
                    const path = collectionItem.getPath();

                    const treeItem =
                        collectionItem instanceof CollectionFile
                            ? new BrunoTreeItem(
                                  path,
                                  true,
                                  getSequenceFromMetaBlock(path)
                              )
                            : new BrunoTreeItem(path, false);

                    return treeItem;
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
            this.collectionItemProvider.getAncestorCollectionForPath(
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
