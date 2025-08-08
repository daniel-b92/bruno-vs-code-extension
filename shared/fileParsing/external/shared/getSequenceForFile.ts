import {
    BrunoFileType,
    Collection,
    getFileType,
    parseSequenceFromMetaBlock,
} from "../../..";

export async function getSequenceForFile(
    collection: Collection,
    filePath: string,
) {
    if (
        (await getFileType(collection, filePath)) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromMetaBlock(filePath);
}
