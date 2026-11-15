import { TypedCollectionItemProvider, getSequencesForFolders } from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { basename } from "path";

export async function normalizeSequencesForFolders(
    itemProvider: TypedCollectionItemProvider,
    parentFolder: string,
    sequenceStep = 1,
    sortEqualSequencesByName = false,
) {
    const initialSequences = await getSequencesForFolders(
        itemProvider,
        parentFolder,
    );

    initialSequences.sort((item1, item2) => {
        const sequenceDifference = item1.sequence - item2.sequence;
        return (
            sequenceDifference ||
            (sortEqualSequencesByName
                ? basename(item1.folderPath).localeCompare(
                      basename(item2.folderPath),
                  )
                : 0)
        );
    });

    for (let i = 0; i < initialSequences.length; i++) {
        const { settingsFile, sequence: initialSeq } = initialSequences[i];
        const newSeq = (i + 1) * sequenceStep;

        if (initialSeq != newSeq) {
            await replaceSequenceForFile(settingsFile, newSeq);
        }
    }
}
