import {
    getSequencesForRequestsAndAppFiles,
    normalizePath,
} from "@global_shared";
import {
    getSequenceStepFromSettings,
    shouldRenumberSequencesAutomatically,
    TypedCollectionItemProvider,
} from "@shared";
import { basename } from "path";
import { window } from "vscode";
import { normalizeSequencesForRequestsAndAppFiles } from "./normalizeSequencesForRequestsAndAppFiles";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { FileInsertionPosition } from "./interfaces";
import {
    calculateSequenceChangesForInsertion,
    SequenceInsertionPoint,
    SequenceInsertionPointType,
} from "../sequenceUtils/calculateSequenceChangesForInsertion";
import { setSequenceInFile } from "../sequenceUtils/setSequenceInFile";

/**
 * Sets the sequence of a newly inserted (or moved) request or app file, without changing the sequences of other files if possible.
 * A file that overwrote the targeted file takes over its sequence. Otherwise, the sequence depends on the target position.
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
    /** The sequence of the file that was overwritten by the inserted one. */
    replacedSequence?: number,
) {
    const { targetDirectory, otherDirectory } = directoriesForNormalization;
    const sequenceStep = getSequenceStepFromSettings();

    const collection = itemProvider.getAncestorCollectionForPath(newPath);

    if (!collection) {
        window.showErrorMessage(
            `Could not determine the collection for path '${newPath}'.`,
        );
        return;
    }

    const setSequence = async (sequence: number) => {
        if (replacedSequence !== undefined) {
            // The overwritten file had a sequence, so the new one needs one too, even if it has none yet.
            return await setSequenceInFile(
                newPath,
                sequence,
                collection.getFormat(),
            );
        }

        // A file without a sequence does not get one.
        await replaceSequenceForFile(newPath, sequence);
        return true;
    };

    const wasSuccessful =
        replacedSequence !== undefined &&
        isFileTargeted(targetPosition, newPath)
            ? await setSequence(replacedSequence)
            : await setSequenceForTargetPosition(
                  itemProvider,
                  targetPosition,
                  newPath,
                  targetDirectory,
                  sequenceStep,
                  setSequence,
              );

    if (!wasSuccessful) {
        window.showErrorMessage(
            `An unexpected error occurred while trying to set the sequence of '${basename(newPath)}'.`,
        );
        return;
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

async function setSequenceForTargetPosition(
    itemProvider: TypedCollectionItemProvider,
    targetPosition: FileInsertionPosition,
    newPath: string,
    targetDirectory: string,
    sequenceStep: number,
    setSequence: (sequence: number) => Promise<boolean>,
) {
    // The inserted file must not be considered, because it may already have a sequence (e.g. when moving it within the same directory).
    const otherFiles = (
        await getSequencesForRequestsAndAppFiles(itemProvider, targetDirectory)
    ).filter(({ path }) => normalizePath(path) != normalizePath(newPath));

    const { newSequence, shiftedItems } = calculateSequenceChangesForInsertion(
        otherFiles,
        getInsertionPoint(targetPosition),
        sequenceStep,
    );

    if (!(await setSequence(newSequence))) {
        return false;
    }

    for (const { path, sequence } of shiftedItems) {
        await replaceSequenceForFile(path, sequence);
    }

    return true;
}

function isFileTargeted(
    targetPosition: FileInsertionPosition,
    filePath: string,
) {
    return (
        typeof targetPosition == "object" &&
        normalizePath(targetPosition.item.getPath()) == normalizePath(filePath)
    );
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
