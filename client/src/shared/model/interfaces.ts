import { TestItem } from "vscode";
import {
    CollectionData,
    CollectionItemProvider,
    ReadyOnlyCollection,
} from "@global_shared";
import { BrunoTreeItem } from "./brunoTreeItem";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = ReadyOnlyCollection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export interface AdditionalCollectionData {
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}
