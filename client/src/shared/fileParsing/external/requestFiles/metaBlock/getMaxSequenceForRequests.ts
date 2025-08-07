import { CollectionItemProvider } from "../../../../fileSystemCache/externalHelpers/collectionItemProvider";
import { getSequencesForRequests } from "./getSequencesForRequests";

export async function getMaxSequenceForRequests(
    itemProvider: CollectionItemProvider,
    directory: string
) {
    return Math.max(
        ...(await getSequencesForRequests(itemProvider, directory)).map(
            ({ sequence }) => sequence
        )
    );
}
