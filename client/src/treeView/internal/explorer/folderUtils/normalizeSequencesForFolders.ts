import { TypedCollectionItemProvider, getSequencesForFolders } from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";

export async function normalizeSequencesForFolders(
    itemProvider: TypedCollectionItemProvider,
    parentFolder: string,
    sequenceStep = 1,
) {
    const initialSequences = await getSequencesForFolders(
        itemProvider,
        parentFolder,
    );

    initialSequences.sort(
        ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2,
    );

    for (let i = 0; i < initialSequences.length; i++) {
        const { settingsFile, sequence: initialSeq } = initialSequences[i];
        const newSeq = (i + 1) * sequenceStep;

        if (initialSeq != newSeq) {
            await replaceSequenceForFile(settingsFile, newSeq);
        }
    }
}
