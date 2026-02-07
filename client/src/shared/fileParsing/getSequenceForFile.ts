import { parseSequenceFromMetaBlock, BrunoFileType } from "@global_shared";
import { getItemType, TypedCollection } from "@shared";

export async function getSequenceForFile(
    collection: TypedCollection,
    filePath: string,
) {
    if (
        (await getItemType(collection, filePath)) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromMetaBlock(filePath);
}
