import { basename, dirname, resolve } from "path";
import { Logger, normalizePath } from "@global_shared";
import { TypedCollectionItemProvider, BrunoTreeItem } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";

export async function moveFolderIntoTargetFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    originalItemSequence?: number,
    logger?: Logger,
) {
    const movedSuccessfully = await moveFolderIfNecessary(
        itemProvider,
        sourcePath,
        targetItem,
        insertionOption,
        logger,
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

    await syncSequencePrefixes(
        itemProvider,
        [
            insertionOption ==
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder
                ? targetItem.getPath()
                : dirname(targetItem.getPath()),
            dirname(sourcePath),
        ],
        logger,
    );
}

async function moveFolderIfNecessary(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    logger?: Logger,
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
        itemProvider,
        sourcePath,
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
            ? resolve(targetItem.getPath(), basename(sourcePath))
            : resolve(dirname(targetItem.getPath()), basename(sourcePath)),
        false,
        logger,
    );

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
    }

    return wasSuccessful;
}
