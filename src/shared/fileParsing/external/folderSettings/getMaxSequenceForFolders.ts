import { CollectionItemProvider, getSequencesForFolders } from "../../..";

export function getMaxSequenceForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
) {
    const sequences = getSequencesForFolders(itemProvider, parentFolder).map(
        ({ sequence }) => sequence
    );

    return sequences.length > 0 ? Math.max(...sequences) : undefined;
}
