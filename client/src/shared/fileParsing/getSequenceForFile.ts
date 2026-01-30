import { parseSequenceFromMetaBlock } from "@global_shared";
import { BrunoFileType, Collection, getItemType } from "@shared";

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
