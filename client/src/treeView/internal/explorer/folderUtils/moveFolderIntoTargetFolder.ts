import { basename, dirname, resolve } from "path";
import { Logger, normalizePath } from "@global_shared";
import { TypedCollectionItemProvider, BrunoTreeItem } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";
import { PathRename } from "../runRequestPaths/getEditsForRunRequestPaths";

export async function moveFolderIntoTargetFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    originalItemSequence?: number,
    logger?: Logger,
) {
    const move = await moveFolderIfNecessary(
        itemProvider,
        sourcePath,
        targetItem,
        insertionOption,
        logger,
    );

    if (!move.wasSuccessful) {
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
        // The collection data may not know the items of the moved folder at their new locations yet.
        move.rename ? [move.rename] : undefined,
    );
}

async function moveFolderIfNecessary(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    logger?: Logger,
): Promise<{ wasSuccessful: boolean; rename?: PathRename }> {
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
        return { wasSuccessful: true };
    }

    const targetPath =
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
            ? resolve(targetItem.getPath(), basename(sourcePath))
            : resolve(dirname(targetItem.getPath()), basename(sourcePath));
    const wasSuccessful = await renameFileOrFolder(
        itemProvider,
        sourcePath,
        targetPath,
        false,
        logger,
    );

    if (!wasSuccessful) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
    }

    return {
        wasSuccessful,
        rename: wasSuccessful
            ? { sourcePath, targetPath, isFile: false }
            : undefined,
    };
}
