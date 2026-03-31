import { BrunoEnvironmentFile, BrunoFileType, CollectionItem } from "../../";

export function isEnvironmentFile(
    item: CollectionItem,
): item is BrunoEnvironmentFile {
    return item.isFile() && item.getItemType() == BrunoFileType.EnvironmentFile;
}
