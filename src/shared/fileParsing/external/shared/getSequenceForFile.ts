import {
    BrunoFileType,
    Collection,
    getItemType,
    parseSequenceFromMetaBlock,
} from "../../..";

export async function getSequenceForFile(
    collection: Collection,
    filePath: string,
) {
    if (
        (await getItemType(collection, filePath)) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromMetaBlock(filePath);
}
