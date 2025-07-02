import { getSequencesForRequests } from "../../../shared";
import { replaceSequenceForRequest } from "./replaceSequenceForRequest";

export function normalizeSequencesForRequestFiles(parentDirectoryPath: string) {
    const initialSequences = getSequencesForRequests(parentDirectoryPath);

    initialSequences.sort(
        ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2
    );

    for (let i = 0; i < initialSequences.length; i++) {
        const { path, sequence: initialSeq } = initialSequences[i];
        const newSeq = i + 1;

        if (initialSeq != newSeq) {
            replaceSequenceForRequest(path, newSeq);
        }
    }
}
