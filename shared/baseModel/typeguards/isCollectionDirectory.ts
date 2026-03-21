import {
    CollectionDirectory,
    CollectionItem,
    isCollectionItemWithSequence,
} from "../../";

export function isCollectionDirectory(
    item: CollectionItem,
): item is CollectionDirectory {
    return !item.isFile() && isCollectionItemWithSequence(item);
}
