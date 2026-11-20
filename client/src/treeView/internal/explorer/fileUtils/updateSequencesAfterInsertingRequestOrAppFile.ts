import {
    getSequencesForRequestsAndAppFiles,
    normalizePath,
} from "@global_shared";
import {
    getSequenceStepFromSettings,
    shouldRenumberSequencesAutomatically,
    TypedCollectionItemProvider,
} from "@shared";
import { normalizeSequencesForRequestsAndAppFiles } from "./normalizeSequencesForRequestsAndAppFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { FileInsertionPosition } from "./interfaces";
import {
    calculateSequenceChangesForInsertion,
    SequenceInsertionPoint,
    SequenceInsertionPointType,
} from "../sequenceUtils/calculateSequenceChangesForInsertion";

/**
 * Sets the sequence of a newly inserted (or moved) request or app file, without changing the sequences of other files if possible.
 * Only if the setting for renumbering sequences automatically is enabled, the sequences of the affected directories are normalized afterwards.
 */
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
    const sequenceStep = getSequenceStepFromSettings();

    // The inserted file must not be considered, because it may already have a sequence (e.g. when moving it within the same directory).
    const otherFiles = (
        await getSequencesForRequestsAndAppFiles(itemProvider, targetDirectory)
    ).filter(({ path }) => normalizePath(path) != normalizePath(newPath));

    const { newSequence, shiftedItems } = calculateSequenceChangesForInsertion(
        otherFiles,
        getInsertionPoint(targetPosition),
        sequenceStep,
    );

    await replaceSequenceForFile(newPath, newSequence);

    for (const { path, sequence } of shiftedItems) {
        await replaceSequenceForFile(path, sequence);
    }

    if (!shouldRenumberSequencesAutomatically()) {
        return;
    }

    await normalizeSequencesForRequestsAndAppFiles(
        itemProvider,
        targetDirectory,
        sequenceStep,
    );

    if (
        otherDirectory != undefined &&
        normalizePath(targetDirectory) != normalizePath(otherDirectory)
    ) {
        await normalizeSequencesForRequestsAndAppFiles(
            itemProvider,
            otherDirectory,
            sequenceStep,
        );
    }
}

function getInsertionPoint(
    targetPosition: FileInsertionPosition,
): SequenceInsertionPoint {
    const targetSequence =
        typeof targetPosition == "object"
            ? targetPosition.item.getSequence()
            : undefined;

    // If the target is a directory (or has no sequence), the file is inserted at the end.
    return targetSequence === undefined
        ? { type: SequenceInsertionPointType.Append }
        : { type: SequenceInsertionPointType.After, sequence: targetSequence };
}
