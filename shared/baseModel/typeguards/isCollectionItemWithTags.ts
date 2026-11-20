import { CollectionItem, CollectionItemWithTags } from "../interfaces";

export function isCollectionItemWithTags(
    item: CollectionItem,
): item is CollectionItemWithTags {
    return "getTags" in item;
}
