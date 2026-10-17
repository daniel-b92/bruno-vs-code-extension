import {
    getMaxSequenceForRequestsAndAppFiles,
    getSequencesForRequestsAndAppFiles,
    normalizePath,
} from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";
import { normalizeSequencesForRequestsAndAppFiles } from "./normalizeSequencesForRequestsAndAppFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { FileInsertionPosition } from "./interfaces";

export async function updateSequencesAfterInsertingRequestOrAppFile(
    itemProvider: TypedCollectionItemProvider,
    targetPosition: FileInsertionPosition,
    newPath: string,
    directoriesForNormalization: {
        targetDirectory: string;
        otherDirectory?: string;
    },
) {
    const { targetDirectory, otherDirectory } = directoriesForNormalization;

    const newSequence =
        typeof targetPosition == "object"
            ? targetPosition.item.getSequence()
                ? (targetPosition.item.getSequence() as number) + 1
                : ((await getMaxSequenceForRequestsAndAppFiles(
                      itemProvider,
                      targetDirectory,
                  )) ?? 0) + 1
            : ((await getMaxSequenceForRequestsAndAppFiles(
                  itemProvider,
                  targetDirectory,
              )) ?? 0) + 1;

    await replaceSequenceForFile(newPath, newSequence);

    if (typeof targetPosition == "object") {
        const filtered = (
            await getSequencesForRequestsAndAppFiles(
                itemProvider,
                targetDirectory,
            )
        ).filter(
            ({ path, sequence }) => path != newPath && sequence >= newSequence,
        );

        for (const { path, sequence: initialSequence } of filtered) {
            await replaceSequenceForFile(path, initialSequence + 1);
        }
    }

    await normalizeSequencesForRequestsAndAppFiles(
        itemProvider,
        targetDirectory,
    );

    if (
        otherDirectory != undefined &&
        normalizePath(targetDirectory) != normalizePath(otherDirectory)
    ) {
        await normalizeSequencesForRequestsAndAppFiles(
            itemProvider,
            otherDirectory,
        );
    }
}
