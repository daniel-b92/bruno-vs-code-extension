import { basename, resolve } from "path";
import {
    CollectionItemProvider,
    getMaxSequenceForRequests,
    getSequencesForRequests,
} from "../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { normalizeSequencesForRequestFiles } from "./normalizeSequencesForRequestFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

export function updateSequencesAfterMovingRequestFile(
    itemProvider: CollectionItemProvider,
    target: BrunoTreeItem,
    targetDirectory: string,
    sourcePath: string
) {
    const newPath = resolve(targetDirectory, basename(sourcePath));

    const newSequence = target.isFile
        ? target.getSequence()
            ? (target.getSequence() as number) + 1
            : getMaxSequenceForRequests(itemProvider, targetDirectory) + 1
        : getMaxSequenceForRequests(itemProvider, targetDirectory) + 1;

    replaceSequenceForFile(newPath, newSequence);

    if (target.isFile) {
        getSequencesForRequests(itemProvider, targetDirectory)
            .filter(
                ({ path, sequence }) =>
                    path != newPath && sequence >= newSequence
            )
            .forEach(({ path, sequence: initialSequence }) => {
                replaceSequenceForFile(path, initialSequence + 1);
            });
    }

    normalizeSequencesForRequestFiles(itemProvider, targetDirectory);
}
