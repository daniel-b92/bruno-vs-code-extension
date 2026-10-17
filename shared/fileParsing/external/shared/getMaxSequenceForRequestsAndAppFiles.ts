import { getSequencesForRequestsAndAppFiles } from "./getSequencesForRequestsAndAppFiles";
import { CollectionItemProvider } from "../../..";

export async function getMaxSequenceForRequestsAndAppFiles<T>(
    itemProvider: CollectionItemProvider<T>,
    directory: string,
) {
    const sequences = await getSequencesForRequestsAndAppFiles(
        itemProvider,
        directory,
    );

    if (sequences.length == 0) {
        return undefined;
    }

    return Math.max(...sequences.map(({ sequence }) => sequence));
}
