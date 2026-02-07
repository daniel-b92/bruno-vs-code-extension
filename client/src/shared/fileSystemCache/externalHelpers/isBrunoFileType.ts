import {
    BrunoFileType,
    ItemType,
    NonBrunoSpecificItemType,
} from "@global_shared";

export function isBrunoFileType(itemType: ItemType): itemType is BrunoFileType {
    return (
        !(Object.values(NonBrunoSpecificItemType) as ItemType[]).includes(
            itemType,
        ) && (Object.values(BrunoFileType) as ItemType[]).includes(itemType)
    );
}
