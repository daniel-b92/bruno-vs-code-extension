import { basename, resolve } from "path";
import {
    CollectionItemProvider,
    getMaxSequenceForRequests,
    getSequencesForRequests,
} from "../../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { normalizeSequencesForRequestFiles } from "./normalizeSequencesForRequestFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

export async function updateSequencesAfterMovingRequestFile(
    itemProvider: CollectionItemProvider,
    target: BrunoTreeItem,
    targetDirectory: string,
    sourcePath: string
) {
    const newPath = resolve(targetDirectory, basename(sourcePath));

    const newSequence = target.isFile
        ? target.getSequence()
            ? (target.getSequence() as number) + 1
            : (await getMaxSequenceForRequests(itemProvider, targetDirectory)) +
              1
        : (await getMaxSequenceForRequests(itemProvider, targetDirectory)) + 1;

    await replaceSequenceForFile(newPath, newSequence);

    if (target.isFile) {
        const filtered = (
            await getSequencesForRequests(itemProvider, targetDirectory)
        ).filter(
            ({ path, sequence }) => path != newPath && sequence >= newSequence
        );

        for (const { path, sequence: initialSequence } of filtered) {
            await replaceSequenceForFile(path, initialSequence + 1);
        }
    }

    await normalizeSequencesForRequestFiles(itemProvider, targetDirectory);
}
