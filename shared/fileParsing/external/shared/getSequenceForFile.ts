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
    if (
        (await getItemType(collection, filePath)) != BrunoFileType.RequestFile
    ) {
        return undefined;
    }

    return await parseSequenceFromFile(filePath);
}
