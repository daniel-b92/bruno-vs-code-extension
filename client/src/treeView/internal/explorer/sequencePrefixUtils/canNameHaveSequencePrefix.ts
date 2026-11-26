import {
    BrunoFileType,
    CollectionDirectory,
    CollectionItem,
} from "@global_shared";

/** Requests, app files and folders with a settings file can have a sequence, so their names can start with it. */
export function canNameHaveSequencePrefix(item: CollectionItem) {
    const itemType = item.getItemType();

    return (
        itemType == BrunoFileType.RequestFile ||
        itemType == BrunoFileType.AppFile ||
        (item instanceof CollectionDirectory &&
            item.getSettingsFilePath() !== undefined)
    );
}
