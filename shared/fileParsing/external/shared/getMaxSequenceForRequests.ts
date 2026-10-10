import { getSequencesForRequests } from "./getSequencesForRequests";
import { CollectionItemProvider } from "../../..";

export async function getMaxSequenceForRequests<T>(
    itemProvider: CollectionItemProvider<T>,
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
