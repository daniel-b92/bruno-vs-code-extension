import { getSequencesForRequestsAndAppFiles } from "@global_shared";
import { TypedCollectionItemProvider } from "../../../../shared";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { basename } from "path";

export async function normalizeSequencesForRequestsAndAppFiles(
    itemProvider: TypedCollectionItemProvider,
    parentDirectoryPath: string,
    sequenceStep = 1,
    sortEqualSequencesByName = false,
) {
    const initialSequences = await getSequencesForRequestsAndAppFiles(
        itemProvider,
        parentDirectoryPath,
    );

    initialSequences.sort((item1, item2) => {
        const sequenceDifference = item1.sequence - item2.sequence;
        return (
            sequenceDifference ||
            (sortEqualSequencesByName
                ? basename(item1.path).localeCompare(basename(item2.path))
                : 0)
        );
    });

    for (let i = 0; i < initialSequences.length; i++) {
        const { path, sequence: initialSeq } = initialSequences[i];
        const newSeq = (i + 1) * sequenceStep;

        if (initialSeq != newSeq) {
            await replaceSequenceForFile(path, newSeq);
        }
    }
}
