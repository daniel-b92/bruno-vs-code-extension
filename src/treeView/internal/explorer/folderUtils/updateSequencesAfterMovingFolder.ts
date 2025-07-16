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
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { replaceNameInMetaBlock } from "../fileUtils/replaceNameInMetaBlock";
import { promisify } from "util";
import { readFile } from "fs";

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
        const newFolderSettingsFile = await getFolderSettingsFilePath(
            newFolderPath
        );

        const newSequence =
            1 +
            ((await getMaxSequenceForFolders(itemProvider, parentFolder)) ?? 0);

        if (!newFolderSettingsFile) {
            window.showErrorMessage(
                `An unexpected error occured while trying to find the folder settings file for the folder '${newFolderPath}'`
            );
            return;
        }

        await replaceSequenceForFile(newFolderSettingsFile, newSequence);
        await normalizeSequencesForFolders(itemProvider, parentFolder);
        await normalizeSequencesForFolders(itemProvider, dirname(sourcePath));
        return;
    }

    const newFolderSettingsFile = await copyFolderSettingsFile(
        target,
        sourcePath
    );

    if (!newFolderSettingsFile) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    const parentFolder = dirname(target.getPath());

    const newSequence =
        insertionOption == FolderDropInsertionOption.InsertBeforeTarget
            ? (target.getSequence() as number)
            : (target.getSequence() as number) + 1;

    await replaceSequenceForFile(newFolderSettingsFile, newSequence);

    const filtered = (
        await getSequencesForFolders(itemProvider, parentFolder)
    ).filter(
        ({ folderPath, sequence }) =>
            folderPath != sourcePath && sequence >= newSequence
    );

    for (const { folderPath, sequence: initialSequence } of filtered) {
        await replaceSequenceForFile(
            (await getFolderSettingsFilePath(folderPath)) as string,
            initialSequence + 1
        );
    }

    await normalizeSequencesForFolders(itemProvider, parentFolder);
}

async function copyFolderSettingsFile(
    sourceFolderItem: BrunoTreeItem,
    destinationFolder: string
) {
    const targetFolderSettingsFile = await getFolderSettingsFilePath(
        sourceFolderItem.getPath()
    );

    if (!targetFolderSettingsFile) {
        window.showErrorMessage(
            `An unexpected error occured. Could not find settings file for target folder '${basename(
                sourceFolderItem.getPath()
            )}'`
        );
        return;
    }

    const newFolderSettingsFilePath = resolve(
        destinationFolder,
        basename(targetFolderSettingsFile)
    );

    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.createFile(Uri.file(newFolderSettingsFilePath), {
        overwrite: true,
        contents: Buffer.from(
            await promisify(readFile)(targetFolderSettingsFile)
        ),
    });
    const wasSuccessful = await workspace.applyEdit(workspaceEdit);

    if (!wasSuccessful) {
        return undefined;
    }

    await replaceNameInMetaBlock(
        newFolderSettingsFilePath,
        basename(destinationFolder)
    );

    return newFolderSettingsFilePath;
}
