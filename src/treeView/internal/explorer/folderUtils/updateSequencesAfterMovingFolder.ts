import { basename, dirname, resolve } from "path";
import {
    CollectionItemProvider,
    getFolderSettingsFilePath,
    getMaxSequenceForFolders,
    getSequencesForFolders,
} from "../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { normalizeSequencesForFolders } from "./normalizeSequencesForFolders";
import { Uri, window, workspace, WorkspaceEdit } from "vscode";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { readFileSync } from "fs";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";

export async function updateSequencesAfterMovingFolder(
    itemProvider: CollectionItemProvider,
    sourcePath: string,
    target: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption
) {
    if (
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        const parentFolder = target.getPath();
        const newFolderPath = resolve(parentFolder, basename(sourcePath));
        const newFolderSettingsFile = getFolderSettingsFilePath(newFolderPath);

        // ToDo: Check if the drag and drop target can be a file when moving a folder
        const newSequence =
            1 + (getMaxSequenceForFolders(itemProvider, parentFolder) ?? 0);

        if (!newFolderSettingsFile) {
            window.showErrorMessage(
                `An unexpected error occured while trying to find the folder settings file for the folder '${newFolderPath}'`
            );
            return;
        }

        replaceSequenceForFile(newFolderSettingsFile, newSequence);
        normalizeSequencesForFolders(itemProvider, parentFolder);
        return;
    }

    const newFolderSettingsFile = await copyFolderSettingsFileFromTargetFolder(
        sourcePath,
        target
    );

    if (!newFolderSettingsFile) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    const newSequence =
        insertionOption == FolderDropInsertionOption.InsertBeforeTarget
            ? (target.getSequence() as number)
            : (target.getSequence() as number) + 1;

    replaceSequenceForFile(newFolderSettingsFile, newSequence);

    getSequencesForFolders(itemProvider, dirname(target.getPath()))
        .filter(
            ({ folderPath, sequence }) =>
                folderPath != sourcePath && sequence >= newSequence
        )
        .forEach(({ folderPath, sequence: initialSequence }) => {
            replaceSequenceForFile(
                getFolderSettingsFilePath(folderPath) as string,
                initialSequence + 1
            );
        });
}

async function copyFolderSettingsFileFromTargetFolder(
    sourcePath: string,
    target: BrunoTreeItem
) {
    const targetFolderSettingsFile = getFolderSettingsFilePath(
        target.getPath()
    );

    if (!targetFolderSettingsFile) {
        window.showErrorMessage(
            `An unexpected error occured. Could not find settings file for target folder '${basename(
                target.getPath()
            )}'`
        );
        return;
    }

    const newFolderSettingsFilePath = resolve(
        sourcePath,
        basename(targetFolderSettingsFile)
    );

    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.createFile(
        Uri.file(newFolderSettingsFilePath),
        // ToDo: replace name in folder.bru file with source path folder name
        {
            overwrite: true,
            contents: Buffer.from(readFileSync(targetFolderSettingsFile)),
        }
    );
    const wasSuccessful = await workspace.applyEdit(workspaceEdit);
    return wasSuccessful ? newFolderSettingsFilePath : undefined;
}
