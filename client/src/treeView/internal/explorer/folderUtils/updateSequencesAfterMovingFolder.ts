import { basename, dirname, resolve } from "path";
import {
    BrunoFileType,
    CollectionFormat,
    getFolderSettingsFilePath,
    normalizePath,
} from "@global_shared";
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
import { Uri, window, workspace, WorkspaceEdit } from "vscode";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { replaceItemName } from "../fileUtils/replaceItemName";
import { promisify } from "util";
import { readFile } from "fs";

export async function updateSequencesAfterMovingFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    target: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
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
        const newFolderSettingsFile = await getFolderSettingsFilePath(
            false,
            newFolderPath,
            format,
        );

        if (!newFolderSettingsFile) {
            window.showErrorMessage(
                `An unexpected error occured while trying to find the folder settings file for the folder '${newFolderPath}'`,
            );
            return;
        }

        const { newSequence } = calculateSequenceChangesForInsertion(
            await getSequencesOfOtherFolders(itemProvider, parentFolder, [
                newFolderPath,
            ]),
            { type: SequenceInsertionPointType.Append },
            sequenceStep,
        );

        await replaceSequenceForFile(newFolderSettingsFile, newSequence);

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

    const newFolderSettingsFile = await copyFolderSettingsFile(
        target,
        sourcePath,
        format,
    );

    if (!newFolderSettingsFile) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    const parentFolder = dirname(target.getPath());

    const { newSequence, shiftedItems } = calculateSequenceChangesForInsertion(
        await getSequencesOfOtherFolders(itemProvider, parentFolder, [
            sourcePath,
            resolve(parentFolder, basename(sourcePath)),
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

    await replaceSequenceForFile(newFolderSettingsFile, newSequence);

    for (const { path: settingsFile, sequence } of shiftedItems) {
        await replaceSequenceForFile(settingsFile, sequence);
    }

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

async function copyFolderSettingsFile(
    sourceFolderItem: BrunoTreeItem,
    destinationFolder: string,
    format: CollectionFormat,
) {
    const isCollectionSettings = false;
    const targetFile = await getFolderSettingsFilePath(
        isCollectionSettings,
        sourceFolderItem.getPath(),
        format,
    );

    if (!targetFile) {
        window.showErrorMessage(
            `An unexpected error occured. Could not find settings file for target folder '${basename(
                sourceFolderItem.getPath(),
            )}'`,
        );
        return;
    }

    const newPath = resolve(destinationFolder, basename(targetFile));

    const workspaceEdit = new WorkspaceEdit();
    const targetFileContent = await promisify(readFile)(targetFile).catch(
        () => undefined,
    );

    if (targetFileContent === undefined) {
        window.showErrorMessage(
            `An unexpected error occured while trying to copy the folder settings file.`,
        );
        return undefined;
    }

    workspaceEdit.createFile(Uri.file(newPath), {
        overwrite: true,
        contents: Buffer.from(targetFileContent),
    });
    const wasSuccessful = await workspace.applyEdit(workspaceEdit);

    if (!wasSuccessful) {
        return undefined;
    }

    await replaceItemName(
        newPath,
        basename(destinationFolder),
        BrunoFileType.FolderSettingsFile,
        format,
    );

    return newPath;
}
