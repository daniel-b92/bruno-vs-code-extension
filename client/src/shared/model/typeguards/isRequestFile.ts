import {
    BrunoRequestFile,
    CollectionItem,
    isCollectionItemWithSequence,
} from "../..";

export function isRequestFile(item: CollectionItem): item is BrunoRequestFile {
    return item.isFile() && isCollectionItemWithSequence(item);
}
