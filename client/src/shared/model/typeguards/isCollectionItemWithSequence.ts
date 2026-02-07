import {
    CollectionItem,
    CollectionItemWithSequence,
} from "../interfaces_generic";

export function isCollectionItemWithSequence(
    item: CollectionItem,
): item is CollectionItemWithSequence {
    return "getSequence" in item;
}
