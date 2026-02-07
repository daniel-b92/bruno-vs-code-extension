import {
    parseSequenceFromMetaBlock,
    BrunoFileType,
    getItemType,
} from "@global_shared";
import { TypedCollection } from "@shared";

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
