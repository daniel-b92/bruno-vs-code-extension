import { CollectionItemProvider, getSequencesForFolders } from "../../..";

export async function getMaxSequenceForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
) {
    const sequences = (
        await getSequencesForFolders(itemProvider, parentFolder)
    ).map(({ sequence }) => sequence);

    return sequences.length > 0 ? Math.max(...sequences) : undefined;
}
