import { TestItem } from "vscode";
import {
    Collection,
    CollectionData,
    CollectionItemProvider,
} from "@global_shared";
import { BrunoTreeItem } from "../../treeView/brunoTreeItem";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = Collection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export interface AdditionalCollectionData {
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}
