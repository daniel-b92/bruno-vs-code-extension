import {
    BrunoFileType,
    BrunoRequestFile,
    CollectionItem,
    isCollectionItemWithSequence,
} from "../../";

export function isRequestFile(item: CollectionItem): item is BrunoRequestFile {
    return (
        item.isFile() &&
        item.getItemType() == BrunoFileType.RequestFile &&
        isCollectionItemWithSequence(item)
    );
}
