import { CollectionItemProvider, getSequencesForFolders } from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";

export async function normalizeSequencesForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string,
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
        const newSeq = i + 1;

        if (initialSeq != newSeq) {
            await replaceSequenceForFile(settingsFile, newSeq);
        }
    }
}
