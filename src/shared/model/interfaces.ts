import { TestItem } from "vscode";
import { BrunoTreeItem } from "../../treeView/brunoTreeItem";

export interface CollectionItem {
    getPath: () => string;
    getSequence: () => number | undefined;
}

export interface CollectionData {
    item: CollectionItem;
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}
