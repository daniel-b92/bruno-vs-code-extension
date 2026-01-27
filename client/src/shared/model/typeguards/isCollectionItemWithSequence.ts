import { CollectionItem, CollectionItemWithSequence } from "../interfaces";

export function isCollectionItemWithSequence(
    item: CollectionItem,
): item is CollectionItemWithSequence {
    return "getSequence" in item;
}
