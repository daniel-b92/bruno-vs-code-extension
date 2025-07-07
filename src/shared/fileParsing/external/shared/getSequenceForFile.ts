import {
    BrunoFileType,
    Collection,
    getTypeOfBrunoFile,
    parseSequenceFromMetaBlock,
} from "../../..";

export function getSequenceForFile(collection: Collection, filePath: string) {
    if (
        getTypeOfBrunoFile([collection], filePath) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return parseSequenceFromMetaBlock(filePath);
}
