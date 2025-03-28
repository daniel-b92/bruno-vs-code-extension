import { TestItem } from "vscode";
import { BrunoTreeItem } from "./brunoTreeItem";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFile } from "./collectionFile";

export interface CollectionItem {
    getPath: () => string;
}

export interface CollectionData {
    item: CollectionFile | CollectionDirectory;
    treeItem: BrunoTreeItem;
    testItem?: TestItem;
}
