import {
    getMaxSequenceForRequests,
    getSequencesForRequests,
    normalizePath,
} from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { normalizeSequencesForRequestFiles } from "./normalizeSequencesForRequestFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

export async function updateSequencesAfterMovingRequestFile(
    itemProvider: TypedCollectionItemProvider,
    target: BrunoTreeItem,
    newPath: string,
    directoriesForNormalization: {
        targetDirectory: string;
        otherDirectory?: string;
    },
) {
    const { targetDirectory, otherDirectory } = directoriesForNormalization;

    const newSequence = target.isFile
        ? target.getSequence()
            ? (target.getSequence() as number) + 1
            : ((await getMaxSequenceForRequests(
                  itemProvider,
                  targetDirectory,
              )) ?? 0) + 1
        : ((await getMaxSequenceForRequests(itemProvider, targetDirectory)) ??
              0) + 1;

    await replaceSequenceForFile(newPath, newSequence);

    if (target.isFile) {
        const filtered = (
            await getSequencesForRequests(itemProvider, targetDirectory)
        ).filter(
            ({ path, sequence }) => path != newPath && sequence >= newSequence,
        );

        for (const { path, sequence: initialSequence } of filtered) {
            await replaceSequenceForFile(path, initialSequence + 1);
        }
    }

    await normalizeSequencesForRequestFiles(itemProvider, targetDirectory);

    if (
        otherDirectory != undefined &&
        normalizePath(targetDirectory) != normalizePath(otherDirectory)
    ) {
        await normalizeSequencesForRequestFiles(itemProvider, otherDirectory);
    }
}
