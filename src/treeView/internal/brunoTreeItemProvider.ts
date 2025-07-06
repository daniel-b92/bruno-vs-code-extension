import { basename, dirname } from "path";
import * as vscode from "vscode";
import {
    getSequenceFromMetaBlock,
    CollectionData,
    FileChangeType,
    CollectionItemProvider,
    normalizeDirectoryPath,
    CollectionFile,
    OutputChannelLogger,
    getSequenceForFolder,
} from "../../shared";
import { BrunoTreeItem } from "../brunoTreeItem";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>
{
    constructor(
        private workspaceRoot: string,
        private collectionItemProvider: CollectionItemProvider,
        private logger?: OutputChannelLogger
    ) {
        collectionItemProvider.subscribeToUpdates()(
            ({ updateType, changedData, data: { item } }) => {
                if (
                    updateType == FileChangeType.Deleted ||
                    updateType == FileChangeType.Created ||
                    (updateType == FileChangeType.Modified &&
                        changedData?.sequenceChanged)
                ) {
                    this.logger?.debug(
                        `Triggering update of collection tree view root item due to change event for cached item '${item.getPath()}'.`
                    );

                    // Always update all items when items have to be deleted from / created for the tree view.
                    // When only triggering an update for the parent item, there were issues with the refresh mechanism.
                    this._onDidChangeTreeData.fire(undefined);
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
        this.logger?.info(
            `Triggering full cache refresh and afterwards a refresh of the collection explorer tree.`
        );

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
            this.logger?.debug(
                `Fetching root items for collection explorer tree.`
            );

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
                this.logger?.debug(
                    `Could not determine collection for tree item ${element.getPath()}. Returning an empty list for the requested child items.`
                );
                return [];
            }

            this.logger?.debug(
                `Fetching child explorer tree items for item '${element.getPath()}' for collection '${basename(
                    collection.getRootDirectory()
                )}' collection.`
            );

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
                    const isFile = collectionItem instanceof CollectionFile;

                    const treeItem = new BrunoTreeItem(
                        path,
                        isFile,
                        isFile
                            ? getSequenceFromMetaBlock(path)
                            : getSequenceForFolder(path)
                    );

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
