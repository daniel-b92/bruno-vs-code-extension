import { CollectionItemProvider, getSequencesForFolders } from "../../..";

export function getMaxSequenceForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
) {
    return Math.max(
        ...getSequencesForFolders(itemProvider, parentFolder).map(
            ({ sequence }) => sequence
        )
    );
}
