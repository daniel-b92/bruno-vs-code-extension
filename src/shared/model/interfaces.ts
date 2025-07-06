import { TestItem } from "vscode";
import { BrunoTreeItem } from "../../treeView/brunoTreeItem";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFile } from "./collectionFile";

export interface CollectionItem {
    getPath: () => string;
    getSequence: () => number | undefined;
}

export interface CollectionData {
    item: CollectionFile | CollectionDirectory;
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}
