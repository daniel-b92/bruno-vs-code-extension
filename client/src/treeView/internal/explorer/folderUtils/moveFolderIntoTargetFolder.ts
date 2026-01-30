import { basename, dirname, resolve } from "path";
import { normalizeDirectoryPath } from "@global_shared";
import { CollectionItemProvider } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";

export async function moveFolderIntoTargetFolder(
    itemProvider: CollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    originalItemSequence?: number,
) {
    const movedSuccessfully = await moveFolderIfNecessary(
        sourcePath,
        targetItem,
        insertionOption,
    );

    if (!movedSuccessfully) {
        return;
    }

    if (
        originalItemSequence ||
        insertionOption != FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        await updateSequencesAfterMovingFolder(
            itemProvider,
            sourcePath,
            targetItem,
            insertionOption,
        );
    }
}

async function moveFolderIfNecessary(
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
) {
    if (
        (insertionOption ==
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder &&
            normalizeDirectoryPath(targetItem.getPath()) ==
                normalizeDirectoryPath(dirname(sourcePath))) ||
        (insertionOption !=
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder &&
            normalizeDirectoryPath(dirname(targetItem.getPath())) ==
                normalizeDirectoryPath(dirname(sourcePath)))
    ) {
        return true;
    }

    const wasSuccessful = await renameFileOrFolder(
        sourcePath,
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
            ? resolve(targetItem.getPath(), basename(sourcePath))
            : resolve(dirname(targetItem.getPath()), basename(sourcePath)),
        false,
    );

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
    }

    return wasSuccessful;
}
