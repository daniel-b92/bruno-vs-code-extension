import { basename, dirname } from "path";
import * as vscode from "vscode";
import { normalizeDirectoryPath, FileChangeType } from "@global_shared";
import {
    TypedCollectionItemProvider,
    OutputChannelLogger,
    TypedCollection,
    TypedCollectionData,
} from "@shared";
import { BrunoTreeItem } from "../brunoTreeItem";

export class BrunoTreeItemProvider implements vscode.TreeDataProvider<BrunoTreeItem> {
    constructor(
        private workspaceRoot: string,
        private collectionItemProvider: TypedCollectionItemProvider,
        private logger?: OutputChannelLogger,
    ) {
        collectionItemProvider.subscribeToUpdates()((updates) => {
            const relevantUpdates = updates.filter(
                ({ updateType, changedData }) =>
                    updateType == FileChangeType.Deleted ||
                    updateType == FileChangeType.Created ||
                    (updateType == FileChangeType.Modified &&
                        (changedData?.sequenceChanged ||
                            changedData?.tagsChanged)),
            );
            if (relevantUpdates.length == 0) {
                return;
            }

            this.logger?.debug(
                `${this.commonIdentifierForLogging} Collection tree view refresh due to events for ${relevantUpdates.length} items.`,
            );

            const allParents = relevantUpdates.map(
                ({ collection, data: { item } }) => ({
                    collection,
                    data: collectionItemProvider.getRegisteredItem(
                        collection,
                        dirname(item.getPath()),
                    ),
                }),
            );

            if (allParents.some(({ data }) => data == undefined)) {
                this.logger?.debug(
                    `${this.commonIdentifierForLogging} Triggering tree view refresh at root level because some items do not have registered parents.`,
                );

                this._onDidChangeTreeData.fire(undefined);
                return;
            }

            const distinctParentItems = (
                allParents as {
                    collection: TypedCollection;
                    data: TypedCollectionData;
                }[]
            ).reduce(
                (prev, curr) => {
                    const {
                        collection: currentCollection,
                        data: { item: currentItem },
                    } = curr;
                    const collectionRoot = currentCollection.getRootDirectory();

                    const ancestorAlreadyAdded = prev.some(
                        ({ collection: c, data: { item: i } }) =>
                            c.isRootDirectory(collectionRoot) &&
                            normalizeDirectoryPath(
                                currentItem.getPath(),
                            ).startsWith(normalizeDirectoryPath(i.getPath())),
                    );

                    return ancestorAlreadyAdded ? prev : prev.concat(curr);
                },
                [] as {
                    collection: TypedCollection;
                    data: TypedCollectionData;
                }[],
            );

            if (relevantUpdates.length > 1) {
                this.logger?.debug(
                    `${this.commonIdentifierForLogging} Triggering a tree view refresh for each of ${distinctParentItems.length} distinct parent items.`,
                );
            }

            for (const {
                data: {
                    additionalData: { treeItem },
                },
            } of distinctParentItems) {
                this._onDidChangeTreeData.fire(treeItem);
            }
        });
    }

    private commonIdentifierForLogging = "[TreeItemProvider]";

    getTreeItem(element: BrunoTreeItem): vscode.TreeItem {
        return element as unknown as vscode.TreeItem;
    }

    getParent(element: BrunoTreeItem) {
        const { collection } = this.mapTreeItemToCollectionItem(element);

        const registeredParent = this.collectionItemProvider.getRegisteredItem(
            collection,
            dirname(element.getPath()),
        );

        return registeredParent
            ? registeredParent.additionalData.treeItem
            : undefined;
    }

    public refresh() {
        this.logger?.info(
            `${this.commonIdentifierForLogging} Triggering full cache refresh and afterwards a refresh of the collection explorer tree.`,
        );

        return new Promise<void>((resolve) => {
            this.collectionItemProvider.refreshCache().then(() => {
                this._onDidChangeTreeData.fire(undefined);
                resolve();
            });
        });
    }

    async getChildren(element?: BrunoTreeItem): Promise<BrunoTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(
                "No Bruno test data found in empty workspace",
            );
            return [];
        }

        if (!element) {
            this.logger?.debug(
                `${this.commonIdentifierForLogging} Fetching root items for collection explorer tree.`,
            );

            return this.collectionItemProvider
                .getRegisteredCollections()
                .map(
                    (collection) =>
                        (
                            collection.getStoredDataForPath(
                                collection.getRootDirectory(),
                            ) as TypedCollectionData
                        ).additionalData.treeItem,
                )
                .sort((a, b) =>
                    (a.label as string) > (b.label as string) ? 1 : -1,
                );
        } else {
            const collection =
                this.collectionItemProvider.getAncestorCollectionForPath(
                    element.getPath(),
                );

            if (!collection) {
                this.logger?.debug(
                    `${this.commonIdentifierForLogging} Could not determine collection for tree item ${element.getPath()}. Returning an empty list for the requested child items.`,
                );
                return [];
            }

            this.logger?.debug(
                `${this.commonIdentifierForLogging} Fetching child explorer tree items for item '${element.getPath()}' for collection '${basename(
                    collection.getRootDirectory(),
                )}' collection.`,
            );

            return this.getSortedTreeItems(
                await Promise.all(
                    collection
                        .getAllStoredDataForCollection()
                        .filter(
                            ({ item: registeredItem }) =>
                                normalizeDirectoryPath(
                                    dirname(registeredItem.getPath()),
                                ) == normalizeDirectoryPath(element.getPath()),
                        )
                        .map(
                            async ({ additionalData: { treeItem } }) =>
                                treeItem,
                        ),
                ),
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
                item.getPath(),
            );

        if (!collection) {
            throw new Error(
                `No registered collection found for tree item with path '${item.getPath()}'.`,
            );
        }

        return {
            collection,
            item: this.collectionItemProvider.getRegisteredItem(
                collection,
                item.getPath(),
            ),
        };
    }

    private getSortedTreeItems(items: BrunoTreeItem[]) {
        return items.slice().sort((a, b) => {
            if (a.isFile != b.isFile) {
                // Display all subfolders before files
                return a.isFile ? 1 : -1;
            } else if (
                !a.getSequence() &&
                !b.getSequence() &&
                a.label &&
                b.label
            ) {
                // Order items without a sequence alphabetically by label
                const labelForA =
                    typeof a.label == "string" ? a.label : a.label.label;
                const labelForB =
                    typeof b.label == "string" ? b.label : b.label.label;

                return labelForA <= labelForB ? -1 : 1;
            } else if (!a.getSequence() || !b.getSequence()) {
                // Diplay items with a sequence before items without one
                return a.getSequence() ? -1 : 1;
            } else if (a.getSequence() && b.getSequence()) {
                return (
                    (a.getSequence() as number) - (b.getSequence() as number)
                );
            } else {
                return 0;
            }
        });
    }
}
