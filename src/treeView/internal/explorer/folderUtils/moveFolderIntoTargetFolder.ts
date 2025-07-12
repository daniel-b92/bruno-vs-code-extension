import { basename, resolve } from "path";
import { CollectionItemProvider } from "../../../../shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";

export async function moveFolderIntoTargetFolder(
    itemProvider: CollectionItemProvider,
    sourcePath: string,
    targetDirectory: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    originalItemSequence?: number
) {
    const wasSuccessful = await renameFileOrFolder(
        sourcePath,
        resolve(targetDirectory.getPath(), basename(sourcePath)),
        false
    );

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    if (
        originalItemSequence ||
        insertionOption != FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        updateSequencesAfterMovingFolder(
            itemProvider,
            sourcePath,
            targetDirectory,
            insertionOption
        );
    }
}
