import {
    BrunoFileType,
    Collection,
    getTypeOfBrunoFile,
    parseSequenceFromMetaBlock,
} from "../../..";

export async function getSequenceForFile(
    collection: Collection,
    filePath: string
) {
    if (
        (await getTypeOfBrunoFile([collection], filePath)) !=
        BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromMetaBlock(filePath);
}
