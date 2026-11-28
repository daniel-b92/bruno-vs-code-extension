import { basename, dirname, resolve } from "path";
import { normalizePath } from "@global_shared";
import {
    getSequencesForFolders,
    getSequenceStepFromSettings,
    shouldRenumberSequencesAutomatically,
    TypedCollectionItemProvider,
    BrunoTreeItem,
} from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { normalizeSequencesForFolders } from "./normalizeSequencesForFolders";
import {
    calculateSequenceChangesForInsertion,
    SequenceInsertionPointType,
} from "../sequenceUtils/calculateSequenceChangesForInsertion";
import { window } from "vscode";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { setSequenceForFolder } from "./setSequenceForFolder";
import { showSequenceGapsHintIfNeeded } from "../sequenceUtils/sequenceGapsHint";

export async function updateSequencesAfterMovingFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    target: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    /** The sequence of the folder that was overwritten by moving into the target folder. The moved folder takes it over. */
    replacedSequence?: number,
) {
    const collection = itemProvider.getAncestorCollectionForPath(sourcePath);

    if (!collection) {
        window.showErrorMessage(
            `Could not determine the collection for the folder '${sourcePath}'.`,
        );
        return;
    }

    const format = collection.getFormat();
    const sequenceStep = getSequenceStepFromSettings();

    if (
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        const parentFolder = target.getPath();
        const newFolderPath = resolve(parentFolder, basename(sourcePath));

        const newSequence =
            replacedSequence ??
            calculateSequenceChangesForInsertion(
                await getSequencesOfOtherFolders(itemProvider, parentFolder, [
                    newFolderPath,
                ]),
                { type: SequenceInsertionPointType.Append },
                sequenceStep,
            ).newSequence;

        if (!(await setSequenceForFolder(newFolderPath, newSequence, format))) {
            showErrorMessageForFailedDragAndDrop(sourcePath);
            return;
        }

        if (shouldRenumberSequencesAutomatically()) {
            await normalizeSequencesForFolders(
                itemProvider,
                parentFolder,
                sequenceStep,
            );
            await normalizeSequencesForFolders(
                itemProvider,
                dirname(sourcePath),
                sequenceStep,
            );
        }
        return;
    }

    const parentFolder = dirname(target.getPath());
    // The folder has already been moved, so `sourcePath` is only its old path (which can be in a different parent folder).
    const newFolderPath = resolve(parentFolder, basename(sourcePath));

    const { newSequence, shiftedItems } = calculateSequenceChangesForInsertion(
        await getSequencesOfOtherFolders(itemProvider, parentFolder, [
            sourcePath,
            newFolderPath,
        ]),
        {
            type:
                insertionOption == FolderDropInsertionOption.InsertBeforeTarget
                    ? SequenceInsertionPointType.Before
                    : SequenceInsertionPointType.After,
            sequence: target.getSequence() as number,
        },
        sequenceStep,
    );

    if (!(await setSequenceForFolder(newFolderPath, newSequence, format))) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    for (const { path: settingsFile, sequence } of shiftedItems) {
        await replaceSequenceForFile(settingsFile, sequence);
    }

    showSequenceGapsHintIfNeeded(shiftedItems.length);

    if (shouldRenumberSequencesAutomatically()) {
        await normalizeSequencesForFolders(
            itemProvider,
            parentFolder,
            sequenceStep,
        );

        if (normalizePath(dirname(sourcePath)) != normalizePath(parentFolder)) {
            await normalizeSequencesForFolders(
                itemProvider,
                dirname(sourcePath),
                sequenceStep,
            );
        }
    }
}

/**
 * Returns the sequences of the subfolders of the parent folder, excluding the moved folder.
 * The path that stores the sequence is the folder settings file of the respective folder.
 */
async function getSequencesOfOtherFolders(
    itemProvider: TypedCollectionItemProvider,
    parentFolder: string,
    excludedFolderPaths: string[],
) {
    const excluded = excludedFolderPaths.map((path) => normalizePath(path));

    return (await getSequencesForFolders(itemProvider, parentFolder))
        .filter(
            ({ folderPath }) => !excluded.includes(normalizePath(folderPath)),
        )
        .map(({ settingsFile, sequence }) => ({
            path: settingsFile,
            sequence,
        }));
}
