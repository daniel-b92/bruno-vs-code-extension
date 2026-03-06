import { CollectionDirectory } from "../collectionDirectory";
import { CollectionItem, NonBrunoSpecificItemType } from "../interfaces";
import { isCollectionItemWithSequence } from "./isCollectionItemWithSequence";

export function isCollectionDirectory(
    item: CollectionItem,
): item is CollectionDirectory {
    return (
        isCollectionItemWithSequence(item) &&
        item.getItemType() == NonBrunoSpecificItemType.Directory
    );
}
