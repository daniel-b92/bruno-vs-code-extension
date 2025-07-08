import { CollectionItemProvider } from "../../../../fileSystemCache/externalHelpers/collectionItemProvider";
import { getSequencesForRequests } from "./getSequencesForRequests";

export function getMaxSequenceForRequests(
    itemProvider: CollectionItemProvider,
    directory: string
) {
    return Math.max(
        ...getSequencesForRequests(itemProvider, directory).map(
            ({ sequence }) => sequence
        )
    );
}
