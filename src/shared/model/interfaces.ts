import { TestItem } from "vscode";
import { BrunoTreeItem } from "../../client/explorer/brunoTreeItem";
import { BrunoFileType } from "./brunoFileTypeEnum";

export interface CollectionItem {
    getPath: () => string;
    getSequence: () => number | undefined;
}

export interface CollectionData {
    item: CollectionItem;
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}

export type FileType = BrunoFileType | "other";
