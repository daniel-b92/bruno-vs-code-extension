import { getSequencesForRequests } from "@global_shared";
import { TypedCollectionItemProvider } from "../../../../shared";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

export async function normalizeSequencesForRequestFiles(
    itemProvider: TypedCollectionItemProvider,
    parentDirectoryPath: string,
) {
    const initialSequences = await getSequencesForRequests(
        itemProvider,
        parentDirectoryPath,
    );

    initialSequences.sort(
        ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2,
    );

    for (let i = 0; i < initialSequences.length; i++) {
        const { path, sequence: initialSeq } = initialSequences[i];
        const newSeq = i + 1;

        if (initialSeq != newSeq) {
            await replaceSequenceForFile(path, newSeq);
        }
    }
}
