import { TypedCollectionItemProvider } from "@shared";
import { getSequencesForRequests } from "./getSequencesForRequests";

export async function getMaxSequenceForRequests(
    itemProvider: TypedCollectionItemProvider,
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
