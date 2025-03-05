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
    ) {}

    public handleItemDeletion(itemPath: string) {
        const maybeRegisteredItem = this.itemRegistry.getItem(itemPath);

        if (!maybeRegisteredItem) {
            return;
        }

        this.itemRegistry.unregisterItem(itemPath);
        this.itemRegistry.unregisterAllDescendants(itemPath);

        const maybeParent = this.itemRegistry.getItem(
            dirname(maybeRegisteredItem.getPath())
        );

        if (maybeParent) {
            this.treeItemEventEmitter.fire(maybeParent);
        } else {
            // If no parent item was found, trigger update for all items (e.g. if item is collection root directory).
            this.treeItemEventEmitter.fire(undefined);
        }
    }
}
