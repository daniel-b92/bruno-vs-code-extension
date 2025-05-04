import { getSequencesForRequests } from "./getSequencesForRequests";

export function getMaxSequenceForRequests(directory: string) {
    return Math.max(
        ...getSequencesForRequests(directory).map(({ sequence }) => sequence)
    );
}
