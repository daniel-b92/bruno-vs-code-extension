import { basename, dirname, resolve } from "path";
import { normalizePath } from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";

export async function moveFolderIntoTargetFolder(
    itemProvider: TypedCollectionItemProvider,
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
            normalizePath(targetItem.getPath()) ==
                normalizePath(dirname(sourcePath))) ||
        (insertionOption !=
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder &&
            normalizePath(dirname(targetItem.getPath())) ==
                normalizePath(dirname(sourcePath)))
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
