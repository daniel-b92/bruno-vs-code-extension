import {
    parseSequenceFromMetaBlock,
    BrunoFileType,
    getItemType,
    Collection,
} from "../..";

export async function getSequenceForFile<T>(
    collection: Collection<T>,
    filePath: string,
) {
    if (
        (await getItemType(collection, filePath)) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromMetaBlock(filePath);
}
