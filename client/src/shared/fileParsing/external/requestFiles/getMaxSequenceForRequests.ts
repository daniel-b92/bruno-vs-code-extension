import { CollectionItemProvider } from "../../../fileSystemCache/externalHelpers/collectionItemProvider";
import { getSequencesForRequests } from "./getSequencesForRequests";

export async function getMaxSequenceForRequests(
    itemProvider: CollectionItemProvider,
    directory: string,
) {
    const sequencesForRequests = await getSequencesForRequests(
        itemProvider,
        directory,
    );

    if (sequencesForRequests.length == 0) {
        return undefined;
    }

    return Math.max(...sequencesForRequests.map(({ sequence }) => sequence));
}
