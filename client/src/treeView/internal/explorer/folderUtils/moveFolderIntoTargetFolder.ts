import { basename, dirname, resolve } from "path";
import { getSequenceForFolder, Logger, normalizePath } from "@global_shared";
import { TypedCollectionItemProvider, BrunoTreeItem } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { getSequencesBeforeChange } from "../sequencePrefixUtils/getSequencesBeforeChange";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";
import { PathRename } from "../runRequestPaths/getEditsForRunRequestPaths";

export async function moveFolderIntoTargetFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    originalItemSequence?: number,
    logger?: Logger,
    /** Whether an existing item at the new path should be replaced (see `renameFileOrFolder`). */
    overwrite = false,
) {
    const affectedFolders = [
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
            ? targetItem.getPath()
            : dirname(targetItem.getPath()),
        dirname(sourcePath),
    ];
    const previousSequences = await getSequencesBeforeChange(
        itemProvider,
        affectedFolders,
    );
    // Has to be read before the existing folder is overwritten. Overwriting is only supported for moving into the target folder.
    const replacedSequence =
        overwrite &&
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
            ? await getSequenceOfFolder(
                  itemProvider,
                  resolve(targetItem.getPath(), basename(sourcePath)),
              )
            : undefined;
    const move = await moveFolderIfNecessary(
        itemProvider,
        sourcePath,
        targetItem,
        insertionOption,
        logger,
        overwrite,
    );

    if (!move.wasSuccessful) {
        return;
    }

    if (
        originalItemSequence ||
        replacedSequence !== undefined ||
        insertionOption != FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        await updateSequencesAfterMovingFolder(
            itemProvider,
            sourcePath,
            targetItem,
            insertionOption,
            replacedSequence,
        );
    }

    await syncSequencePrefixes(itemProvider, affectedFolders, {
        logger,
        previousSequences,
        // The collection data may not know the items of the moved folder at their new locations yet.
        previousRenames: move.rename ? [move.rename] : undefined,
    });
}

async function getSequenceOfFolder(
    itemProvider: TypedCollectionItemProvider,
    folderPath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(folderPath);

    return collection
        ? await getSequenceForFolder(
              collection.getRootDirectory(),
              folderPath,
              collection.getFormat(),
          )
        : undefined;
}

async function moveFolderIfNecessary(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetItem: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
    logger?: Logger,
    overwrite?: boolean,
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
        overwrite,
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
