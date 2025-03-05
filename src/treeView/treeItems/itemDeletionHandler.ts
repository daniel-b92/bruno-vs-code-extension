import { dirname } from "path";
import { BrunoTreeItem } from "./brunoTreeItem";
import { TreeItemRegistry } from "./treeItemRegistry";
import * as vscode from "vscode";

export class ItemDeletionHandler {
    constructor(
        private itemRegistry: TreeItemRegistry,
        private treeItemEventEmitter: vscode.EventEmitter<
            BrunoTreeItem | undefined
        >
    ) {
        this.itemAddedToQueue = new vscode.EventEmitter<BrunoTreeItem>();
        this.itemAddedToQueue.event((item) => {
            const itemsBeforeCountdown = this.queuedDeletions.push(item);

            setTimeout(() => {
                if (this.queuedDeletions.length == itemsBeforeCountdown) {
                    this.flushDeletionQueue();
                }
            }, 500);
        });
    }

    private queuedDeletions: BrunoTreeItem[] = [];
    private itemAddedToQueue: vscode.EventEmitter<BrunoTreeItem>;

    public handleItemDeletion(itemPath: string) {
        const maybeRegisteredItem = this.itemRegistry.getItem(itemPath);

        if (!maybeRegisteredItem) {
            return;
        }

        this.itemAddedToQueue.fire(maybeRegisteredItem);
    }

    private flushDeletionQueue() {
        const deletedPaths: string[] = [];

        const paths = this.queuedDeletions
            .map((item) => item.getPath())
            .sort((a, b) => a.length - b.length);

        while (paths.length > 0) {
            const toDelete = paths.splice(0, 1)[0];

            this.queuedDeletions.splice(
                this.queuedDeletions.findIndex(
                    (item) => item.getPath() == toDelete
                ),
                1
            );

            if (!deletedPaths.some((deleted) => toDelete.includes(deleted))) {
                // Case where no ancestor item has already been handled.
                // In this case, we need to unregister the item and all registered descendants.
                deletedPaths.push(toDelete);
                this.itemRegistry.unregisterItem(toDelete);
                this.itemRegistry.unregisterAllDescendants(toDelete);

                const maybeParent = this.itemRegistry.getItem(
                    dirname(toDelete)
                );

                if (maybeParent) {
                    this.treeItemEventEmitter.fire(maybeParent);
                } else {
                    // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
                    this.treeItemEventEmitter.fire(undefined);
                }
            }
        }
    }
}
