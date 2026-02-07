import { BrunoTreeItem } from "src/treeView/brunoTreeItem";
import { TestItem } from "vscode";
import { CollectionItemProvider } from "../fileSystemCache/externalHelpers/collectionItemProvider";
import { Collection } from "./collection";
import { CollectionData } from "./interfaces_generic";

export type TypedCollectionItemProvider =
    CollectionItemProvider<AdditionalCollectionData>;

export type TypedCollection = Collection<AdditionalCollectionData>;

export type TypedCollectionData = CollectionData<AdditionalCollectionData>;

export interface AdditionalCollectionData {
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}
