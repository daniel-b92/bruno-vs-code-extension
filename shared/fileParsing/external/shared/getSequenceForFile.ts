import {
    parseSequenceFromFile,
    BrunoFileType,
    getItemType,
    ReadyOnlyCollection,
} from "../../..";

export async function getSequenceForFile<T>(
    collection: ReadyOnlyCollection<T>,
    filePath: string,
) {
    const itemType = await getItemType(collection, filePath);

    // Request files and app files share the same sequence range within a folder.
    if (
        itemType != BrunoFileType.RequestFile &&
        itemType != BrunoFileType.AppFile
    ) {
        return undefined;
    }

    return await parseSequenceFromFile(filePath);
}
