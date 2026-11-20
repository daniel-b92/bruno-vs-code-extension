import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionItem,
    isCollectionDirectory,
    isRequestFile,
} from "../../";

/**
 * Checks whether the item is one of the items whose sequence determines the order of execution (and display) of requests
 * and folders within a collection.
 *
 * In contrast to `isCollectionItemWithSequence`, items that have a sequence but are not part of that order (like app files) are excluded.
 */
export function isRequestFileOrCollectionDirectory(
    item: CollectionItem,
): item is BrunoRequestFile | CollectionDirectory {
    return isRequestFile(item) || isCollectionDirectory(item);
}
