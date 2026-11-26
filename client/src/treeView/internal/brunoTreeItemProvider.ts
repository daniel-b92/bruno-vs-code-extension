import { basename, dirname } from "path";
import * as vscode from "vscode";
import { normalizePath, FileChangeType } from "@global_shared";
import {
    TypedCollectionItemProvider,
    OutputChannelLogger,
    TypedCollection,
    TypedCollectionData,
    BrunoTreeItem,
} from "@shared";
import { ContextRootItemProvider } from "./contextRoots/contextRootItemProvider";
import { ContextRootTreeItem } from "./contextRoots/contextRootTreeItem";
import { sortTreeItems } from "./sortTreeItems";

export class BrunoTreeItemProvider
    implements vscode.TreeDataProvider<BrunoTreeItem>, vscode.Disposable
{
    constructor(
        private workspaceRoot: string,
        private itemProvider: TypedCollectionItemProvider,
        private contextRootProvider: ContextRootItemProvider,
        private logger?: OutputChannelLogger,
    ) {
        this.disposables.push(
            // The labels of the items depend on whether names are prefixed with sequences.
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (
                    event.affectsConfiguration(
                        "bru-as-code.prefixNamesWithSequence",
                    )
                ) {
                    this._onDidChangeTreeData.fire(undefined);
                }
            }),
        );

        contextRootProvider.onDidChange((item) =>
            this._onDidChangeTreeData.fire(item),
        );
        // Added or deleted collections already cause a refresh of the root level via the subscription below.
        itemProvider.subscribeToAdditionalContextRootChanges(() =>
            this._onDidChangeTreeData.fire(undefined),
        );

        itemProvider.subscribeToUpdates((updates) => {
            const relevantUpdates = updates.filter(
                (update) =>
                    update.updateType == FileChangeType.Deleted ||
                    update.updateType == FileChangeType.Created ||
                    (update.updateType == FileChangeType.Modified &&
                        (update.changedData?.sequenceChanged ||
                            update.changedData?.tagsChanged ||
                            update.changedData?.additionalDataChanged)),
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
                    data: itemProvider.getRegisteredItem(
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
                            normalizePath(currentItem.getPath()).startsWith(
                                normalizePath(i.getPath()),
                            ),
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
    private disposables: vscode.Disposable[] = [];

    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    getTreeItem(element: BrunoTreeItem): vscode.TreeItem {
        element.updateLabel();

        return element as unknown as vscode.TreeItem;
    }

    getParent(element: BrunoTreeItem) {
        if (element instanceof ContextRootTreeItem) {
            return this.contextRootProvider.getParent(element);
        }

        const collection = this.itemProvider.getAncestorCollectionForPath(
            element.getPath(),
        );

        if (!collection) {
            return undefined;
        }

        const registeredParent = this.itemProvider.getRegisteredItem(
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
            this.itemProvider.refreshCache().then(() => {
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

        await this.itemProvider.ensureCacheIsLoaded();

        if (!element) {
            this.logger?.debug(
                `${this.commonIdentifierForLogging} Fetching root items for collection explorer tree.`,
            );

            const collectionRoots = this.itemProvider
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

            // The context roots are shown after the collections.
            return [
                ...collectionRoots,
                ...(await this.contextRootProvider.getRootItems()),
            ];
        } else if (element instanceof ContextRootTreeItem) {
            return element.isFile
                ? []
                : await this.contextRootProvider.getChildren(element);
        } else {
            const collection = this.itemProvider.getAncestorCollectionForPath(
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

            return sortTreeItems(
                await Promise.all(
                    collection
                        .getAllStoredDataForCollection()
                        .filter(
                            ({ item: registeredItem }) =>
                                normalizePath(
                                    dirname(registeredItem.getPath()),
                                ) == normalizePath(element.getPath()),
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
}
