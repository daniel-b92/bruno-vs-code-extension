import {
    CollectionItemProvider,
    getSequencesForFolders,
} from "../../../../shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";

export function normalizeSequencesForFolders(
    itemProvider: CollectionItemProvider,
    parentFolder: string
) {
    const initialSequences = getSequencesForFolders(itemProvider, parentFolder);

    initialSequences.sort(
        ({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2
    );

    initialSequences.forEach(({ settingsFile, sequence: initialSeq }, i) => {
        const newSeq = i + 1;

        if (initialSeq != newSeq) {
            replaceSequenceForFile(settingsFile, newSeq);
        }
    });
}
